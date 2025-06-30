# Death Guard Reference

This file describes the reference dataset for the **Death Guard** faction. The
data is extracted from the BattleScribe catalogue and includes more than just
unit profiles. The JSON now contains the following top‑level sections:

* **units** – each unit's name, internal id, points value and categories.
* **detachments** – available detachments extracted from the *Detachment
  Choice* entry. Each detachment lists any rules it provides.
* **enhancements** – all enhancements from the shared entry group of that
  name with their points costs and rule text.
* **stratagems** – currently empty as the catalogue does not define them.
* **army_rules** – shared rules that apply to the faction (e.g. *Nurgle's
  Gift*).

The dataset is created by running:

```bash
python3 scripts/extract_deathguard.py
```

This will regenerate `docs/death_guard_reference.json`. If stratagem
definitions are added to the catalogue in the future, the script will populate
the `stratagems` section automatically.
