import frappe


@frappe.whitelist()
def get_unique_gsm_values(shaft_production_run: str):
    if not shaft_production_run:
        return []

    doc = frappe.get_doc("Shaft Production Run", shaft_production_run)

    # Robust lookup: find any child table that has a `gsm` field.
    values = []
    for df in doc.meta.get_table_fields():
        child_rows = getattr(doc, df.fieldname, None) or []
        for row in child_rows:
            gsm = getattr(row, "gsm", None) if hasattr(row, "gsm") else row.get("gsm")
            if gsm in (None, "") and hasattr(row, "sticker_gsm"):
                gsm = getattr(row, "sticker_gsm", None)
            if gsm in (None, "") and hasattr(row, "target_gsm"):
                gsm = getattr(row, "target_gsm", None)
                
            if gsm is not None and str(gsm).strip() != "":
                try:
                    values.append(float(gsm))
                except Exception:
                    pass

    return sorted(set(v for v in values if v > 0))


@frappe.whitelist()
def get_batches_from_shaft(shaft_production_run: str):
    if not shaft_production_run:
        return []

    doc = frappe.get_doc("Shaft Production Run", shaft_production_run)
    batches = []
    
    # User specified the table name is 'items'
    if hasattr(doc, "items") and doc.items:
        for row in doc.items:
            batch = getattr(row, "batch_no", None)
            if batch and str(batch).strip() != "":
                batches.append(str(batch).strip())
                
    return sorted(set(batches))


@frappe.whitelist()
def create_quality_checking_from_shaft(shaft_production_run: str, batch_no: str = None):
    """
    Creates one `Quality Checking` document for the given Shaft Production Run,
    and auto-fills `sections` (one row per unique GSM) filtered by batch_no if provided.
    """
    if not shaft_production_run:
        frappe.throw("Missing shaft_production_run")

    shaft = frappe.get_doc("Shaft Production Run", shaft_production_run)
    
    # Filter GSM values based on the selected batch
    all_gsm_values = []
    if hasattr(shaft, "items") and shaft.items:
        for row in shaft.items:
            row_batch = getattr(row, "batch_no", None)
            if batch_no and row_batch != batch_no:
                continue
                
            gsm = getattr(row, "gsm", None) if hasattr(row, "gsm") else row.get("gsm")
            if gsm in (None, "") and hasattr(row, "sticker_gsm"):
                gsm = getattr(row, "sticker_gsm", None)
            if gsm in (None, "") and hasattr(row, "target_gsm"):
                gsm = getattr(row, "target_gsm", None)
                
            if gsm is not None and str(gsm).strip() != "":
                try:
                    all_gsm_values.append(float(gsm))
                except Exception:
                    pass
    
    gsm_values = sorted(set(v for v in all_gsm_values if v > 0))
    
    if not gsm_values:
        frappe.throw("No GSM values found for the selected batch.")

    qc = frappe.new_doc("Quality Checking")
    qc.shaft_production_run = shaft.name
    qc.batch_no = batch_no or getattr(shaft, "batch_no", None)
    qc.quality = getattr(shaft, "quality", None)
    
    # Fetch additional fields from shaft
    qc.order_code = getattr(shaft, "custom_order_code", None)
    qc.unit = getattr(shaft, "custom_unit", None)
    qc.shift = getattr(shaft, "shift", None)
    
    color_val = getattr(shaft, "custom_color", None)
    if not color_val:
        color_val = getattr(shaft, "color", None)
    qc.color = color_val
    
    # Fetch fabric_type from Production Plan
    prod_plan_id = getattr(shaft, "production_plan", None)
    if prod_plan_id:
        try:
            prod_plan = frappe.get_doc("Production Plan", prod_plan_id)
            qc.fabric_type = getattr(prod_plan, "custom_fabric_type", None)
        except Exception:
            pass

    # If quality is stored in the child rows, pick from first matching row.
    for df in shaft.meta.get_table_fields():
        child_rows = getattr(shaft, df.fieldname, None) or []
        for row in child_rows:
            if qc.quality in (None, "") and hasattr(row, "quality"):
                if getattr(row, "quality", None):
                    qc.quality = row.quality
                    break
        if qc.quality:
            break

    # Extract Roll No if batch_no contains '/'
    if qc.batch_no and "/" in qc.batch_no:
        parts = qc.batch_no.split("/", 1)
        qc.batch_no = parts[0].strip()
        qc.roll_no = parts[1].strip()

    for gsm in gsm_values:
        child = qc.append("sections", {})
        child.representative_gsm = gsm
        child.quality = qc.quality

    qc.insert(ignore_permissions=True)
    frappe.db.commit()
    return qc.name

