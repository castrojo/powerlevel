"""Tests for scripts/compute.py — run with: python3 -m pytest scripts/tests/"""

import json
import os
import shutil
import subprocess
import sys
import tempfile

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
COMPUTE_SCRIPT = os.path.join(REPO_ROOT, "scripts", "compute.py")


def _write(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=2)


def _read(path):
    with open(path) as f:
        return json.load(f)


def _run_compute(tmpdir):
    return subprocess.run(
        [sys.executable, COMPUTE_SCRIPT],
        cwd=tmpdir,
        capture_output=True,
        text=True,
    )


def _make_fixture(tmpdir):
    """Populate a minimal data/ directory for testing."""
    skill_levels = {"workflow": 3, "github": 2, "other": 1}

    pl_data = {
        "season": {"name": "Test Season"},
        "stats": {},
        "ghost_messages": [],
        "weapons": {
            "workflow": {"weapon": "Trustee", "element": "arc", "level": 1, "aspect": "KNOCKOUT", "weapon_type": "Legendary Weapon", "subclass": "arc", "super": "THUNDERCRASH"},
            "github":   {"weapon": "Chaperone", "element": "arc", "level": 1, "aspect": "KNOCKOUT", "weapon_type": "Legendary Weapon", "subclass": "arc", "super": "THUNDERCRASH"},
            "other":    {"weapon": "Something", "element": "solar", "level": 1, "aspect": "RADIANT", "weapon_type": "Legendary Weapon", "subclass": "solar", "super": "HAMMER OF SOL"},
        },
    }

    triumphs = {
        "categories": [
            {
                "id": "general",
                "triumphs": [
                    {"id": "first_session", "points": 10, "earned": False},
                    {"id": "seal_blacksmith", "points": 25, "earned": True},
                ],
            }
        ]
    }

    seals = {
        "equipped_title": "None",
        "seals": [
            {
                "id": "blacksmith",
                "name": "BLACKSMITH",
                "title": "Blacksmith",
                "element": "arc",
                "icon": "🔨",
                "difficulty": "veteran",
                "lore": "...",
                "gildable": False,
                "gilded_count": 0,
                "masterworked": False,
                "required_triumph_ids": ["seal_blacksmith", "first_session"],
                "total_triumphs": 0,
                "earned_triumphs": 0,
                "earned": False,
                "seasonal": False,
                "expires_at": None,
            }
        ],
    }

    data_dir = os.path.join(tmpdir, "data")
    os.makedirs(data_dir)
    _write(os.path.join(data_dir, "skill-levels.json"), skill_levels)
    _write(os.path.join(data_dir, "powerlevel-data.json"), pl_data)
    _write(os.path.join(data_dir, "triumphs.json"), triumphs)
    _write(os.path.join(data_dir, "seals.json"), seals)
    # Empty events log
    open(os.path.join(data_dir, "powerlevel-events.jsonl"), "w").close()


class TestComputeWeaponLevels:
    def test_weapon_levels_updated(self, tmp_path):
        _make_fixture(str(tmp_path))
        result = _run_compute(str(tmp_path))
        assert result.returncode == 0, result.stderr

        pl = _read(tmp_path / "data" / "powerlevel-data.json")
        assert pl["weapons"]["workflow"]["level"] == 3
        assert pl["weapons"]["github"]["level"] == 2
        assert pl["weapons"]["other"]["level"] == 1

    def test_missing_weapon_in_skill_levels_skipped(self, tmp_path):
        _make_fixture(str(tmp_path))
        # Add a skill with no matching weapon — should not crash
        sl = _read(tmp_path / "data" / "skill-levels.json")
        sl["nonexistent-skill"] = 5
        _write(str(tmp_path / "data" / "skill-levels.json"), sl)

        result = _run_compute(str(tmp_path))
        assert result.returncode == 0


class TestComputeSealProgress:
    def test_seal_total_triumphs_populated(self, tmp_path):
        """compute.py must set total_triumphs = len(required_triumph_ids)."""
        _make_fixture(str(tmp_path))
        result = _run_compute(str(tmp_path))
        assert result.returncode == 0, result.stderr

        seals = _read(tmp_path / "data" / "seals.json")
        blacksmith = next(s for s in seals["seals"] if s["id"] == "blacksmith")
        assert blacksmith["total_triumphs"] == 2, (
            "total_triumphs must equal len(required_triumph_ids)"
        )

    def test_seal_earned_triumphs_counted(self, tmp_path):
        """compute.py must count earned triumphs against seal required_triumph_ids."""
        _make_fixture(str(tmp_path))
        # seal_blacksmith is already earned=True in fixture
        result = _run_compute(str(tmp_path))
        assert result.returncode == 0, result.stderr

        seals = _read(tmp_path / "data" / "seals.json")
        blacksmith = next(s for s in seals["seals"] if s["id"] == "blacksmith")
        assert blacksmith["earned_triumphs"] == 1, (
            "seal_blacksmith triumph is earned, first_session is not — expect 1"
        )
        assert blacksmith["earned"] is False  # need 2/2

    def test_seal_marked_earned_when_complete(self, tmp_path):
        """Seal is marked earned when all required triumphs are earned."""
        _make_fixture(str(tmp_path))
        # Mark first_session earned too → blacksmith now complete
        t = _read(tmp_path / "data" / "triumphs.json")
        t["categories"][0]["triumphs"][0]["earned"] = True  # first_session
        _write(str(tmp_path / "data" / "triumphs.json"), t)

        result = _run_compute(str(tmp_path))
        assert result.returncode == 0, result.stderr

        seals = _read(tmp_path / "data" / "seals.json")
        blacksmith = next(s for s in seals["seals"] if s["id"] == "blacksmith")
        assert blacksmith["earned_triumphs"] == 2
        assert blacksmith["earned"] is True

    def test_seals_json_written_on_change(self, tmp_path):
        """compute.py must write seals.json when total_triumphs was wrong."""
        _make_fixture(str(tmp_path))
        result = _run_compute(str(tmp_path))
        assert result.returncode == 0

        # total_triumphs was 0 before, now 2 → changed=true
        assert "Seal blacksmith" in result.stdout

    def test_total_triumphs_nonzero_after_compute(self, tmp_path):
        """Regression: seals must not show 0/0 after compute (production bug)."""
        _make_fixture(str(tmp_path))
        _run_compute(str(tmp_path))

        seals = _read(tmp_path / "data" / "seals.json")
        for seal in seals["seals"]:
            assert seal["total_triumphs"] > 0, (
                f"Seal {seal['id']} has total_triumphs=0 — "
                "compute.py must populate from required_triumph_ids"
            )
