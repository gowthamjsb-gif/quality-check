["Quality Checking"].forEach((parentDoctype) => {
frappe.ui.form.on(parentDoctype, {
    refresh(frm) {
        if (frm.is_new() && frm.fields_dict.date && !frm.doc.date) {
            frm.set_value('date', frappe.datetime.get_today());
        }
        toggle_testing_type_fields(frm);
        if (frm.doc.testing_type !== 'Tensile Testing') {
            recalc_all_sections(frm);
            render_custom_html_grid(frm);
        }
    },
    testing_type(frm) {
        toggle_testing_type_fields(frm);
        set_auto_naming_series(frm);
    },
    unit(frm) {
        if (frm.is_new()) {
            set_auto_naming_series(frm);
        }
    },
    validate(frm) {
        const unit_val_clean = (frm.doc.unit || "").toLowerCase().replace(/ /g, "");
        const valid_units = ["unit1", "unit2", "unit3", "unit4"];
        if (!valid_units.includes(unit_val_clean)) {
            frappe.msgprint(__("Quality Testing is only applicable for Unit 1, Unit 2, Unit 3, and Unit 4."));
            frappe.validated = false;
        }
        recalc_all_sections(frm);
    },
    quality(frm) {
        const sectionsField = get_sections_field(frm);
        (frm.doc[sectionsField] || []).forEach((row) => {
            if (!row.quality) {
                frappe.model.set_value(row.doctype, row.name, "quality", frm.doc.quality || "");
            }
        });
        if (frm.doc.testing_type !== 'Tensile Testing') {
            recalc_all_sections(frm);
            render_custom_html_grid(frm);
        }
    }
});
});

frappe.ui.form.on("Tensile Testing Result", {
    sample_1: calc_tensile_row,
    sample_2: calc_tensile_row,
    sample_3: calc_tensile_row,
    sample_4: calc_tensile_row,
    sample_5: calc_tensile_row,
    tensile_sections_remove: function(frm) {
        recalc_tensile_total_samples(frm);
    }
});

function calc_tensile_row(frm, cdt, cdn) {
    const row = frappe.get_doc(cdt, cdn);
    let total = 0;
    let count = 0;
    ['sample_1', 'sample_2', 'sample_3', 'sample_4', 'sample_5'].forEach(f => {
        if (row[f] !== undefined && row[f] !== null && row[f] !== '') {
            total += flt(row[f]);
            count++;
        }
    });
    const avg = count > 0 ? total / count : 0;
    frappe.model.set_value(cdt, cdn, 'average', avg);
    
    recalc_tensile_total_samples(frm);
}

function recalc_tensile_total_samples(frm) {
    let count = 0;
    (frm.doc.tensile_sections || []).forEach(row => {
        ['sample_1', 'sample_2', 'sample_3', 'sample_4', 'sample_5'].forEach(f => {
            if (row[f] !== undefined && row[f] !== null && row[f] !== '') count++;
        });
    });
    safe_set_value(frm, 'tensile_total_samples', count);
}

function toggle_testing_type_fields(frm) {
    const is_tensile = frm.doc.testing_type === 'Tensile Testing';
    
    frm.toggle_display('test_method', is_tensile);
    frm.toggle_display('cutting_template_width', is_tensile);
    frm.toggle_display('cutting_template_height', is_tensile);
    frm.toggle_display('tensile_sections', is_tensile);
    frm.toggle_display('tensile_total_samples', is_tensile);

    frm.toggle_display('sections', !is_tensile);
    frm.toggle_display('custom_gsm_grid_html', !is_tensile);
    frm.toggle_display('gsm_total_samples', !is_tensile);
    frm.toggle_display('gsm_pass_samples', !is_tensile);
    frm.toggle_display('gsm_fail_samples', !is_tensile);
    frm.toggle_display('gsm_overall_result', !is_tensile);

    // Set read_only states
    const keep_editable = [
        'testing_type',
        'batch_no',
        'order_code',
        'shaft_production_run',
        'quality',
        'unit',
        'color',
        'shift',
        'roll_no',
        'gsm_production_entry',
        'date'
    ];
    frm.meta.fields.forEach(f => {
        if (!keep_editable.includes(f.fieldname)) {
            frm.set_df_property(f.fieldname, 'read_only', 1);
        } else {
            // Explicitly unlock these fields to override DocType settings
            frm.set_df_property(f.fieldname, 'read_only', 0);
        }
    });

    if (is_tensile) {
        frm.set_df_property('test_method', 'read_only', 0);
        frm.set_df_property('cutting_template_width', 'read_only', 0);
        frm.set_df_property('cutting_template_height', 'read_only', 0);
        frm.set_df_property('tensile_sections', 'read_only', 0);
        recalc_tensile_total_samples(frm);
    } else {
        frm.set_df_property('sections', 'read_only', 0);
        frm.set_df_property('custom_gsm_grid_html', 'read_only', 0);
        render_custom_html_grid(frm);
    }
}

function set_auto_naming_series(frm) {
    if (!frm.is_new()) return;
    
    const is_tensile = frm.doc.testing_type === 'Tensile Testing';
    const unit_map = {
        "unit1": "U1",
        "unit2": "U2",
        "unit3": "U3",
        "unit4": "U4"
    };
    const unit_val_clean = (frm.doc.unit || "").toLowerCase().replace(/ /g, "");
    const u = unit_map[unit_val_clean] || "U1";
    const prefix = is_tensile ? "TT" : "GSM";
    frm.set_value("naming_series", `JSB/${prefix}-${u}/26-27/.###`);
}

["Quality Checking Section"].forEach((childDoctype) => {
frappe.ui.form.on(childDoctype, {
    representative_gsm(frm, cdt, cdn) {
        recalc_section_and_parent(frm, cdt, cdn);
    },
    quality(frm, cdt, cdn) {
        recalc_section_and_parent(frm, cdt, cdn);
    }
});
});

for (let i = 1; i <= 25; i++) {
    ["Quality Checking Section"].forEach((childDoctype) => {
        frappe.ui.form.on(childDoctype, {
            [`r1_s${i}`]: function (frm, cdt, cdn) {
                recalc_section_and_parent(frm, cdt, cdn);
            },
            [`r2_s${i}`]: function (frm, cdt, cdn) {
                recalc_section_and_parent(frm, cdt, cdn);
            }
        });
    });
}

function get_sections_field(frm) {
    if (frm.fields_dict && frm.fields_dict.sections) return "sections";
    return null;
}

function safe_set_value(frm, fieldname, value) {
    if (frm.fields_dict && frm.fields_dict[fieldname]) {
        frm.set_value(fieldname, value);
    }
}

function add_load_gsm_button(frm) {
    const sectionsField = get_sections_field(frm);
    if (!frm.doc.shaft_production_run || !sectionsField) return;

    frm.add_custom_button(__("Load Quality Sections"), () => {
        frappe.call({
            method: "quality_gsm_app.api.quality.get_unique_gsm_values",
            args: {
                shaft_production_run: frm.doc.shaft_production_run
            },
            callback: (r) => {
                const values = (r.message || []).map((v) => flt(v)).filter((v) => v > 0);
                if (!values.length) {
                    frappe.msgprint(__("No GSM values found in roll_production_results."));
                    return;
                }

                frm.clear_table(sectionsField);
                values.forEach((gsm) => {
                    const row = frm.add_child(sectionsField);
                    row.representative_gsm = gsm;
                    row.quality = frm.doc.quality || "";
                });

                frm.refresh_field(sectionsField);
                recalc_all_sections(frm);
                render_custom_html_grid(frm);
                frappe.show_alert({ message: __("Quality sections loaded"), indicator: "green" });
            }
        });
    });
}

function recalc_section_and_parent(frm, cdt, cdn) {
    const sectionsField = get_sections_field(frm);
    const row = locals[cdt][cdn];
    if (!row || !sectionsField) return;
    recalc_one_section(frm, row);
    recalc_parent_summary(frm);
    update_dom_calculations(row);
}

function recalc_all_sections(frm) {
    const sectionsField = get_sections_field(frm);
    if (!sectionsField) return;
    (frm.doc[sectionsField] || []).forEach((row) => recalc_one_section(frm, row));
    recalc_parent_summary(frm);
}

function get_threshold(qualityText) {
    const q = (qualityText || "").toString().toLowerCase();
    return q.includes("low") || q.includes("lower") ? 5 : 3;
}

function recalc_one_section(frm, row) {
    const sampleCount = 25;
    const setGsm = flt(row.representative_gsm);
    const quality = row.quality || frm.doc.quality || "";
    const threshold = get_threshold(quality);

    let r1Sum = 0;
    let r2Sum = 0;
    let combinedSum = 0;
    let passCount = 0;
    let failCount = 0;
    let anyFailed = false;

    for (let i = 1; i <= sampleCount; i++) {
        const v1 = flt(row[`r1_s${i}`]);
        const v2 = flt(row[`r2_s${i}`]);

        r1Sum += v1;
        r2Sum += v2;

        const avg = flt((v1 + v2) / 2, 3);
        row[`s${i}_combined_avg`] = avg;

        let diff = 0;
        if (setGsm > 0) {
            diff = flt(avg - setGsm, 3);
            const isPass = Math.abs(diff) < threshold;
            if (isPass) passCount += 1;
            else {
                failCount += 1;
                anyFailed = true;
            }
        }
        row[`s${i}_diff`] = diff;
        combinedSum += avg;
    }

    row.r1_average = flt(r1Sum / sampleCount, 3);
    row.r2_average = flt(r2Sum / sampleCount, 3);
    row.grand_average_gsm = flt(combinedSum / sampleCount, 3);

    row.tolerance_limit = threshold;
    row.pass_count = passCount;
    row.fail_count = failCount;
    row.section_result = setGsm > 0 ? (anyFailed ? "FAIL" : "PASS") : "";
}

function recalc_parent_summary(frm) {
    const sectionsField = get_sections_field(frm);
    if (!sectionsField) return;
    const rows = frm.doc[sectionsField] || [];
    let passSamples = 0;
    let failSamples = 0;

    rows.forEach((r) => {
        passSamples += (r.pass_count || 0);
        failSamples += (r.fail_count || 0);
    });
    
    // Each section has exactly 25 samples
    let totalSamples = rows.length * 25;

    safe_set_value(frm, "gsm_total_samples", totalSamples);
    safe_set_value(frm, "gsm_pass_samples", passSamples);
    safe_set_value(frm, "gsm_fail_samples", failSamples);
    safe_set_value(frm, "gsm_overall_result", totalSamples ? (failSamples > 0 ? "FAIL" : "PASS") : "");
}


// -----------------------------------------------------
// CUSTOM HTML GRID RENDERER
// -----------------------------------------------------
function render_custom_html_grid(frm) {
    if (!frm.fields_dict.custom_html_grid) return;
    const wrapper = frm.fields_dict.custom_html_grid.$wrapper;
    wrapper.empty();

    const sectionsField = get_sections_field(frm);
    const rows = frm.doc[sectionsField] || [];
    if (!rows.length) {
        wrapper.html(`<div class="text-muted" style="padding: 15px;">No GSM Sections loaded. Click 'Load Quality Sections' from Shaft Production Run.</div>`);
        return;
    }

    let html = `
        <style>
            .gsm-excel-grid { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; font-family: Inter, sans-serif; table-layout: fixed; }
            .gsm-excel-grid th, .gsm-excel-grid td { border: 1px solid #d1d8dd; padding: 6px 4px; text-align: center; overflow: hidden; }
            .gsm-excel-grid th { background-color: #f3f3f3; font-weight: bold; }
            .gsm-excel-grid input { width: 100%; border: none; text-align: center; font-size: 13px; background: transparent; outline: none; }
            .gsm-excel-grid input:focus { background-color: #e2e8f0; }
            .row-header { font-weight: bold; background-color: #f8f9fa; text-align: left !important; width: 100px; }
            .section-wrapper { margin-bottom: 30px; overflow-x: auto; }
            .set-gsm-col { font-weight: bold; width: 60px; }
            .avg-col { font-weight: bold; background-color: #ecf0f1; width: 60px; }
            .pass-diff { background-color: #eafaf1; color: #1e8449; font-weight: bold; }
            .fail-diff { background-color: #fdedec; color: #c0392b; font-weight: bold; }
            .s-idx-col { width: 45px; }
        </style>
    `;

    rows.forEach((row, idx) => {
        const quality = row.quality || frm.doc.quality || "";
        const limit = get_threshold(quality);

        html += `
        <div class="section-wrapper">
            <h5>Section ${idx + 1} - Set GSM: ${row.representative_gsm} | Result: <span id="res_${row.name}">${row.section_result || '-'}</span></h5>
            <table class="gsm-excel-grid" data-row-name="${row.name}">
                <thead>
                    <tr>
                        <th class="row-header">SI NO: ${idx + 1}</th>
                        <th class="set-gsm-col">SET GSM</th>
        `;
        for (let i = 1; i <= 25; i++) {
            html += `<th class="s-idx-col">S${i}</th>`;
        }
        html += `<th class="avg-col">AVERAGE</th></tr></thead><tbody>`;

        // Row 1
        html += `
            <tr>
                <td class="row-header">GSM (ROW 1)</td>
                <td class="set-gsm-col">${row.representative_gsm}</td>
        `;
        for (let i = 1; i <= 25; i++) {
            html += `<td><input type="number" class="gsm-input" data-row="${row.name}" data-field="r1_s${i}" value="${row[`r1_s${i}`] || ''}" /></td>`;
        }
        html += `<td class="avg-col" id="r1_avg_${row.name}">${row.r1_average || 0}</td></tr>`;

        // Row 2
        html += `
            <tr>
                <td class="row-header">GSM (ROW 2)</td>
                <td class="set-gsm-col">${row.representative_gsm}</td>
        `;
        for (let i = 1; i <= 25; i++) {
            html += `<td><input type="number" class="gsm-input" data-row="${row.name}" data-field="r2_s${i}" value="${row[`r2_s${i}`] || ''}" /></td>`;
        }
        html += `<td class="avg-col" id="r2_avg_${row.name}">${row.r2_average || 0}</td></tr>`;

        // Combined Avg
        html += `
            <tr class="avg-col">
                <td class="row-header">COMBINED AVG</td>
                <td class="set-gsm-col">-</td>
        `;
        for (let i = 1; i <= 25; i++) {
            html += `<td id="cmb_avg_${row.name}_${i}">${row[`s${i}_combined_avg`] || 0}</td>`;
        }
        html += `<td id="grand_avg_${row.name}">${row.grand_average_gsm || 0}</td></tr>`;

        // Diff
        html += `
            <tr>
                <td class="row-header">DIFF</td>
                <td class="set-gsm-col">-</td>
        `;
        for (let i = 1; i <= 25; i++) {
            const d = row[`s${i}_diff`];
            const isPass = (d !== null && d !== undefined && Math.abs(d) < limit);
            const cls = d !== undefined && d !== null ? (isPass ? 'pass-diff' : 'fail-diff') : '';
            html += `<td id="diff_${row.name}_${i}" class="${cls}">${d !== undefined && d !== null ? d : ''}</td>`;
        }
        html += `<td id="sec_res_${row.name}">${row.section_result || ''}</td></tr>`;

        html += `</tbody></table></div>`;
    });

    wrapper.html(html);

    // Bind events
    wrapper.find('.gsm-input').on('change', function() {
        const val = $(this).val();
        const rowName = $(this).data('row');
        const fieldName = $(this).data('field');
        
        // Update frappe model
        frappe.model.set_value("Quality Checking Section", rowName, fieldName, flt(val));
    });
}

function update_dom_calculations(row) {
    if (!row) return;
    const quality = row.quality || cur_frm.doc.quality || "";
    const limit = get_threshold(quality);

    $(`#r1_avg_${row.name}`).text(row.r1_average);
    $(`#r2_avg_${row.name}`).text(row.r2_average);
    $(`#grand_avg_${row.name}`).text(row.grand_average_gsm);
    $(`#res_${row.name}`).text(row.section_result);
    $(`#sec_res_${row.name}`).text(row.section_result);

    for (let i = 1; i <= 25; i++) {
        $(`#cmb_avg_${row.name}_${i}`).text(row[`s${i}_combined_avg`]);
        const d = row[`s${i}_diff`];
        const td = $(`#diff_${row.name}_${i}`);
        td.text(d !== undefined && d !== null ? d : '');
        td.removeClass('pass-diff fail-diff');
        if (d !== undefined && d !== null) {
            td.addClass(Math.abs(d) < limit ? 'pass-diff' : 'fail-diff');
        }
    }
}
