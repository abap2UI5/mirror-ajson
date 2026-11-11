// Local patches on top of the renamed copy of sbcgua/ajson.
//
// `npm run mirror` regenerates src/ from upstream, so a change made in src/ by
// hand is gone a week later. Whatever this copy needs beyond the rename is
// listed here and re-applied after every mirror run. Each patch names the exact
// upstream text it replaces: when upstream changes that text the run fails
// instead of silently shipping an unpatched file - then adjust or drop the patch.
//
// All replacement code must be valid ABAP 7.02: it is applied after the downport.

import { readFileSync, writeFileSync } from "node:fs";

const patches = [
  {
    // abap2UI5 serializes app instances that hold a mapping reference
    file: "src/z2ui5_if_ajson_mapping.intf.abap",
    find: `  PUBLIC.\n`,
    replace: `  PUBLIC.\n\n  INTERFACES if_serializable_object.\n`,
  },
  {
    // ATC "Low Performance Operations on Internal Tables": the subtree delete
    // has no key access to offer (path CP ...), same as the statement above it
    file: "src/z2ui5_cl_ajson.clas.abap",
    find: `      DELETE mt_json_tree WHERE path CP lv_parent_path.\n`,
    replace: `      DELETE mt_json_tree WHERE path CP lv_parent_path. "#EC CI_SORTSEQ\n`,
  },
  {
    // ABAP Cloud has no CL_ABAP_CONV_IN_CE, so the test ended in a tolerable
    // failure there - an ATC warning on every run. Build the character with the
    // released CL_ABAP_CONV_CODEPAGE instead; both calls are dynamic, so the
    // class still compiles on 7.02, where the first branch is taken. This also
    // drops the only reference to IF_AUNIT_CONSTANTS, which ABAP Cloud reports
    // as deprecated and whose successor IF_ABAP_UNIT_CONSTANT 7.02 does not have.
    file: "src/z2ui5_cl_ajson.clas.testclasses.abap",
    find:
      `      CATCH cx_sy_dyn_call_illegal_class.\n` +
      `        cl_abap_unit_assert=>fail( level = if_aunit_constants=>tolerable ).\n`,
    replace:
      `      CATCH cx_sy_dyn_call_illegal_class.\n` +
      `        " no CL_ABAP_CONV_IN_CE in ABAP Cloud: U+1234 is E188B4 in UTF-8\n` +
      `        DATA lo_conv TYPE REF TO object.\n` +
      `        DATA lv_utf8 TYPE xstring.\n` +
      `        DATA lv_ustr TYPE string.\n` +
      `        lv_utf8 = 'E188B4'.\n` +
      `        TRY.\n` +
      `            lv_fm_name = \`CL_ABAP_CONV_CODEPAGE\`.\n` +
      `            CALL METHOD (lv_fm_name)=>create_in\n` +
      `              RECEIVING\n` +
      `                instance = lo_conv.\n` +
      `            CALL METHOD lo_conv->('IF_ABAP_CONV_IN~CONVERT')\n` +
      `              EXPORTING\n` +
      `                source = lv_utf8\n` +
      `              RECEIVING\n` +
      `                result = lv_ustr.\n` +
      `            lv_uchar = lv_ustr.\n` +
      `          CATCH cx_root.\n` +
      `            " neither converter exists: nothing to build the expectation from\n` +
      `            RETURN.\n` +
      `        ENDTRY.\n`,
  },
];

let failed = false;
for (const { file, find, replace } of patches) {
  const text = readFileSync(file, "utf8");
  if (text.includes(replace)) {
    console.log(`already patched: ${file}`);
    continue;
  }
  if (text.split(find).length !== 2) {
    console.error(`PATCH FAILED: ${file} - expected exactly one occurrence of:\n${find}`);
    failed = true;
    continue;
  }
  writeFileSync(file, text.replace(find, () => replace));
  console.log(`patched: ${file}`);
}
process.exit(failed ? 1 : 0);
