"""Tests for the skills service (filesystem-backed CRUD)."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.services.skills_service import (
    _build_skill_md,
    _parse_frontmatter,
    _validate_name,
    create_skill,
    delete_skill,
    get_skill,
    list_skills,
    update_skill,
)


@pytest.fixture(autouse=True)
def mock_skills_dir(tmp_path):
    skills_dir = tmp_path / "skills"
    skills_dir.mkdir()
    with patch("app.services.skills_service.settings") as mock_settings:
        mock_settings.hermes_data_dir = str(tmp_path)
        yield skills_dir


class TestValidateName:
    def test_valid_name(self):
        assert _validate_name("my-skill") == "my-skill"

    def test_normalizes_spaces(self):
        assert _validate_name("My Skill") == "my-skill"

    def test_allows_dots_and_underscores(self):
        assert _validate_name("skill.v2_beta") == "skill.v2_beta"

    def test_rejects_empty(self):
        with pytest.raises(ValueError, match="Invalid skill name"):
            _validate_name("")

    def test_rejects_special_chars(self):
        with pytest.raises(ValueError, match="Invalid skill name"):
            _validate_name("../../etc")


class TestParseFrontmatter:
    def test_parses_yaml_frontmatter(self):
        content = "---\nname: test\ndescription: A skill\nversion: 1.0.0\n---\n# Body"
        meta, body = _parse_frontmatter(content)
        assert meta["name"] == "test"
        assert meta["description"] == "A skill"
        assert body == "# Body"

    def test_no_frontmatter(self):
        content = "Just plain text"
        meta, body = _parse_frontmatter(content)
        assert meta == {}
        assert body == "Just plain text"

    def test_strips_quotes(self):
        content = '---\nname: "quoted"\n---\nbody'
        meta, body = _parse_frontmatter(content)
        assert meta["name"] == "quoted"


class TestBuildSkillMd:
    def test_basic_output(self):
        md = _build_skill_md("test-skill")
        assert "name: test-skill" in md
        assert "version: 0.1.0" in md
        assert "# test-skill" in md

    def test_with_description(self):
        md = _build_skill_md("test", description="A great skill")
        assert "description: A great skill" in md
        assert "A great skill" in md

    def test_with_author(self):
        md = _build_skill_md("test", author="Philip")
        assert "author: Philip" in md


class TestListSkills:
    async def test_empty_dir(self):
        assert await list_skills() == []

    async def test_with_skills(self, mock_skills_dir):
        skill_dir = mock_skills_dir / "my-skill"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text("---\nname: my-skill\ndescription: Test\nversion: 1.0.0\n---\n# My Skill\n")

        result = await list_skills()
        assert len(result) == 1
        assert result[0]["name"] == "my-skill"
        assert result[0]["description"] == "Test"
        assert result[0]["version"] == "1.0.0"

    async def test_ignores_files(self, mock_skills_dir):
        (mock_skills_dir / "not-a-skill.txt").write_text("nope")
        assert await list_skills() == []


class TestGetSkill:
    async def test_existing_skill(self, mock_skills_dir):
        skill_dir = mock_skills_dir / "my-skill"
        skill_dir.mkdir()
        content = "---\nname: my-skill\ndescription: Test\n---\n# My Skill\n"
        (skill_dir / "SKILL.md").write_text(content)

        result = await get_skill("my-skill")
        assert result is not None
        assert result["name"] == "my-skill"
        assert result["description"] == "Test"
        assert result["content"] == content

    async def test_nonexistent_skill(self):
        assert await get_skill("nonexistent") is None


class TestCreateSkill:
    async def test_creates_directory_and_file(self, mock_skills_dir):
        result = await create_skill("new-skill", description="Fresh", author="Test")
        assert result["name"] == "new-skill"
        assert result["description"] == "Fresh"
        assert (mock_skills_dir / "new-skill" / "SKILL.md").exists()

    async def test_with_custom_content(self, mock_skills_dir):
        content = "---\nname: custom\n---\nCustom body"
        result = await create_skill("custom", content=content)
        actual = (mock_skills_dir / "custom" / "SKILL.md").read_text()
        assert actual == content

    async def test_duplicate_raises(self, mock_skills_dir):
        await create_skill("dup-skill")
        with pytest.raises(ValueError, match="already exists"):
            await create_skill("dup-skill")


class TestUpdateSkill:
    async def test_updates_content(self, mock_skills_dir):
        await create_skill("updatable", description="Original")
        new_content = "---\nname: updatable\ndescription: Updated\n---\nNew body"
        result = await update_skill("updatable", new_content)
        assert result is not None
        assert result["description"] == "Updated"

    async def test_nonexistent_returns_none(self):
        assert await update_skill("ghost", "content") is None


class TestDeleteSkill:
    async def test_deletes_existing(self, mock_skills_dir):
        await create_skill("deletable")
        assert await delete_skill("deletable") is True
        assert not (mock_skills_dir / "deletable").exists()

    async def test_nonexistent_returns_false(self):
        assert await delete_skill("ghost") is False
