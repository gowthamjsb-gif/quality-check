frappe.ui.form.on("Shaft Production Run", {
    refresh(frm) {
        // Avoid duplicating button on every refresh.
        if (frm.custom_buttons && frm.custom_buttons[__("Start GSM Testing")]) {
            return;
        }

        frm.add_custom_button(
            __("Start GSM Testing"),
            () => {
                frappe.call({
                    method: "quality_gsm_app.api.quality.get_batches_from_shaft",
                    args: { shaft_production_run: frm.doc.name },
                    callback: (r) => {
                        const batches = r.message || [];
                        if (!batches.length) {
                            // Fallback if no batches found, just create without batch selection
                            create_quality_checking(frm.doc.name, null);
                            return;
                        }
                        
                        frappe.prompt(
                            [{
                                fieldtype: "Select",
                                fieldname: "batch_no",
                                label: __("Select Batch No"),
                                options: batches,
                                reqd: 1
                            }],
                            (values) => {
                                create_quality_checking(frm.doc.name, values.batch_no);
                            },
                            __("Select Batch"),
                            __("Start Testing")
                        );
                    }
                });
            },
            __("Quality")
        );
    }
});

function create_quality_checking(shaft_name, batch_no) {
    frappe.call({
        method: "quality_gsm_app.api.quality.create_quality_checking_from_shaft",
        args: { 
            shaft_production_run: shaft_name,
            batch_no: batch_no
        },
        freeze: true,
        callback: (r) => {
            const name = r.message;
            if (!name) {
                frappe.msgprint(__("Could not create Quality Checking doc."));
                return;
            }
            frappe.set_route("Form", "Quality Checking", name);
        }
    });
}
