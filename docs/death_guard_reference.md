# Death Guard JSON Reference

This document outlines the structure of the JSON file produced from the
`Chaos - Death Guard.cat` catalogue. A separate conversion script reads the
catalogue's XML and assembles a reference object that downstream tools can
consume.

## JSON Sections

### units

Each unit datasheet found in the catalogue is exported. The script locates all
`selectionEntry` elements representing a unit and collects their profiles,
keywords and weapons. These are gathered into an array under `units`.

### detachments

Detachments are discovered under the "Detachment Choice" selection group. For
each child entry the script records the detachment's name and any linked rules.
The results populate the `detachments` array.

### enhancements

Enhancements are parsed from upgrade entries flagged within the catalogue. The
script captures the enhancement name, description and restrictions. These appear
in the `enhancements` section of the JSON.

### stratagems

The catalogue does not provide structured data for stratagems, so the script
cannot reliably extract them. This section is left empty or must be filled
manually.

### army_rules

General army-wide rules are extracted from shared rules or info links such as
"Nurgle's Gift". These are grouped as `army_rules`.

## Limitations

* The script relies on conventions in the catalogue; unusual formatting may lead
  to missing or misnamed entries.
* Because stratagems are absent from the data, they are not currently generated
  automatically.
* External catalogue links may include additional abilities not captured here.
