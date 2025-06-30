import json
from pathlib import Path
import xml.etree.ElementTree as ET


ns = {"bs": "http://www.battlescribe.net/schema/catalogueSchema"}

root_dir = Path(__file__).resolve().parent.parent
catalogue_file = root_dir / "Chaos - Death Guard.cat"
system_file = root_dir / "Warhammer 40,000.gst"

cat_root = ET.parse(catalogue_file).getroot()

units = []
for entry in cat_root.findall('.//bs:selectionEntry', ns):
    if entry.get('type') == 'unit':
        unit = {
            "name": entry.get("name"),
            "id": entry.get("id"),
            "points": None,
            "categories": [],
        }
        cost = entry.find('.//bs:cost[@name="pts"]', ns)
        if cost is not None and cost.get('value'):
            try:
                unit["points"] = float(cost.get("value"))
            except ValueError:
                pass
        for cat in entry.findall('.//bs:categoryLink', ns):
            unit["categories"].append(cat.get("name"))
        units.append(unit)

detachments = []
for group in cat_root.findall('.//bs:selectionEntryGroup[@name="Detachment"]', ns):
    for entry in group.findall('.//bs:selectionEntry', ns):
        det = {
            "name": entry.get("name"),
            "id": entry.get("id"),
            "rules": [],
        }
        for rule in entry.findall('.//bs:rule', ns):
            det["rules"].append({
                "name": rule.get("name"),
                "description": rule.findtext('bs:description', default="", namespaces=ns).strip(),
            })
        detachments.append(det)

enhancements = []
for entry in cat_root.findall('.//bs:sharedSelectionEntryGroups/bs:selectionEntryGroup[@name="Enhancements"]/bs:selectionEntries/bs:selectionEntry', ns):
    enh = {
        "name": entry.get("name"),
        "id": entry.get("id"),
        "points": None,
        "description": "",
    }
    cost = entry.find('.//bs:cost[@name="pts"]', ns)
    if cost is not None and cost.get('value'):
        try:
            enh["points"] = float(cost.get("value"))
        except ValueError:
            pass
    for char in entry.findall('.//bs:characteristic', ns):
        if char.get('name') == 'Description' and char.text:
            enh['description'] += char.text.strip()
    enhancements.append(enh)

army_rules = []
for rule in cat_root.findall('.//bs:sharedRules/bs:rule', ns):
    army_rules.append({
        "name": rule.get("name"),
        "description": rule.findtext('bs:description', default="", namespaces=ns).strip(),
    })

data = {
    "units": units,
    "detachments": detachments,
    "enhancements": enhancements,
    "stratagems": [],
    "army_rules": army_rules,
}

output_file = root_dir / "docs" / "death_guard_reference.json"
with open(output_file, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
