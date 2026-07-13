import frappe


def _sync_client_scripts():
    import os
    app_path = frappe.get_app_path("quality_gsm_app")
    
    scripts = {
        "Quality Checking": "public/js/quality_inspection_gsm.js",
        "Shaft Production Run": "public/js/shaft_production_run_quality_button.js"
    }
    
    for dt, js_path in scripts.items():
        if not frappe.db.exists("DocType", dt):
            continue
            
        full_path = os.path.join(app_path, js_path)
        if not os.path.exists(full_path):
            continue
            
        with open(full_path, "r", encoding="utf-8") as f:
            script_content = f.read()
            
        existing = frappe.get_all("Client Script", filters={"dt": dt}, limit=1)
        if existing:
            cs = frappe.get_doc("Client Script", existing[0].name)
            cs.script = script_content
            cs.enabled = 1
            cs.save(ignore_permissions=True)
        else:
            script_name = f"{dt} Client Script"
            frappe.get_doc({
                "doctype": "Client Script",
                "name": script_name,
                "dt": dt,
                "module": "Quality Checking" if dt == "Quality Checking" else "Manufacturing",
                "script": script_content,
                "enabled": 1
            }).insert(ignore_permissions=True)

    frappe.clear_cache()


def _run_quality_checking_setup():
    # Run latest schema setup in an idempotent way for cloud updates.
    # Cloud-safe: create/update only the new main doctype (Quality Checking) and GSM schema.
    from quality_gsm_app.patches.v2_0 import create_quality_checking_only
    from quality_gsm_app.patches.v1_3 import force_quality_checking_parent_fix
    from quality_gsm_app.patches.v1_4 import ensure_quality_checking_permissions
    from quality_gsm_app.patches.v2_2 import update_gsm_report_layout_excel_style
    from quality_gsm_app.patches.v2_3 import enforce_field_permanence
    from quality_gsm_app.patches.v2_16_add_gsm_shift_session_field import execute as create_gsm_entry_field

    create_quality_checking_only.execute()
    force_quality_checking_parent_fix.execute()
    ensure_quality_checking_permissions.execute()
    update_gsm_report_layout_excel_style.execute()
    enforce_field_permanence.execute()
    create_gsm_entry_field()
    
    _sync_client_scripts()
    
    frappe.db.commit()


def after_install():
    _run_quality_checking_setup()


def after_migrate():
    _run_quality_checking_setup()

