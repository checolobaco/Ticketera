import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls
import os

def create_sas_docx(filename):
    doc = docx.Document()
    
    # Page Margins
    for section in doc.sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)
        
    # Styles Setup
    normal_style = doc.styles['Normal']
    normal_font = normal_style.font
    normal_font.name = 'Calibri'
    normal_font.size = Pt(11)
    normal_font.color.rgb = RGBColor(0x27, 0x27, 0x2A)
    normal_style.paragraph_format.line_spacing = 1.15
    normal_style.paragraph_format.space_after = Pt(6)

    # Colors
    NAVY = RGBColor(0x0F, 0x17, 0x2A)
    DARK_BLUE = RGBColor(0x1E, 0x3A, 0x8A)

    # Header Title
    title_p = doc.add_paragraph()
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_run = title_p.add_run("DOCUMENTO PRIVADO DE CONSTITUCIÓN Y ESTATUTOS SOCIALES\nDE LA SOCIEDAD POR ACCIONES SIMPLIFICADA\nCLOUDTICKETS S.A.S.")
    title_run.bold = True
    title_run.font.size = Pt(14)
    title_run.font.color.rgb = NAVY
    title_p.paragraph_format.space_after = Pt(4)

    subtitle_p = doc.add_paragraph()
    subtitle_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_run = subtitle_p.add_run("(CONSTITUIDA DE CONFORMIDAD CON LA LEY 1258 DE 2008 DE LA REPÚBLICA DE COLOMBIA)")
    sub_run.bold = True
    sub_run.font.size = Pt(10.5)
    sub_run.font.color.rgb = DARK_BLUE
    subtitle_p.paragraph_format.space_after = Pt(18)

    # Preamble / Constituent
    intro_p = doc.add_paragraph()
    intro_p.add_run("En la ciudad de Tuluá, Departamento del Valle del Cauca, República de Colombia, el suscrito accionista constituyente: ")
    intro_p.add_run("RONNY GARCIA GALLEGO").bold = True
    intro_p.add_run(", mayor de edad, domiciliado en la ciudad de Tuluá, Valle del Cauca, identificado con Cédula de Ciudadanía Número ")
    intro_p.add_run("1.116.248.661").bold = True
    intro_p.add_run(" expedida en Tuluá, de nacionalidad colombiana, procedo mediante el presente documento privado, en ejercicio de la libertad de configuración contractual otorgada por la ")
    intro_p.add_run("Ley 1258 de 2008").bold = True
    intro_p.add_run(", a constituir una Sociedad por Acciones Simplificada (S.A.S.) que se regirá por las leyes colombianas y en especial por los siguientes estatutos sociales:")

    def add_article_heading(num_str, title_str):
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(14)
        h.paragraph_format.space_after = Pt(4)
        r1 = h.add_run(num_str)
        r1.bold = True
        r1.font.color.rgb = DARK_BLUE
        r1.font.size = Pt(11.5)
        r2 = h.add_run(" " + title_str)
        r2.bold = True
        r2.font.color.rgb = NAVY
        r2.font.size = Pt(11.5)
        return h

    # CAPITULO I
    doc.add_paragraph().add_run("CAPÍTULO I – RAZÓN SOCIAL, DOMICILIO, OBJETO Y DURACIÓN").bold = True

    add_article_heading("ARTÍCULO 1º –", "RAZÓN SOCIAL:")
    doc.add_paragraph(
        "La sociedad se denominará CLOUDTICKETS S.A.S. En todas las actuaciones de la sociedad, su nombre irá seguido de las palabras 'Sociedad por Acciones Simplificada' o de las iniciales 'S.A.S.'."
    )

    add_article_heading("ARTÍCULO 2º –", "DOMICILIO PRINCIPAL:")
    doc.add_paragraph(
        "El domicilio principal de la sociedad será el municipio de Tuluá, Departamento del Valle del Cauca, República de Colombia. La sociedad podrá establecer sucursales, agencias, filiales o salas de negocios en cualquier lugar del territorio nacional o del exterior, por decisión del Representante Legal o de la Asamblea General de Accionistas."
    )

    add_article_heading("ARTÍCULO 3º –", "OBJETO SOCIAL:")
    doc.add_paragraph(
        "La sociedad tendrá como objeto social principal el desarrollo, diseño, comercialización, operación, mantenimiento y licenciamiento de soluciones tecnológicas e infraestructura de software como servicio (SaaS), destinadas a la gestión digital de eventos, emisión de boletería electrónica, soluciones de control de acceso mediante códigos QR, tecnología NFC y biometría, y pasarelas de intermediación digital de pagos."
    )
    doc.add_paragraph(
        "En desarrollo de su objeto social, la sociedad podrá realizar cualquier actividad comercial o civil lícita tanto en Colombia como en el exterior, incluyendo pero sin limitarse a:"
    )

    activities = [
        "A. Desarrollo, programación, hospedaje e integración de aplicaciones web, móviles y sistemas de procesamiento de datos en la nube.",
        "B. Licenciamiento de software bajo modalidad SaaS (Software as a Service) a organizadores, empresarios y productores de eventos.",
        "C. Prestación de servicios de consultoría informática, analítica de datos, infraestructura de servidores y soporte técnico.",
        "D. Celebración de contratos de mandato comercial de recaudo por cuenta de terceros, alianzas con pasarelas de pago y entidades financieras.",
        "E. Importación, exportación, arrendamiento y comercialización de equipos tecnológicos y dispositivos de lectura y validación.",
        "F. Adquirir, enajenar, gravar o dar en arrendamiento bienes muebles e inmuebles vinculados al desarrollo de la empresa."
    ]
    for act in activities:
        p_act = doc.add_paragraph()
        p_act.paragraph_format.left_indent = Inches(0.3)
        p_act.paragraph_format.space_after = Pt(2)
        p_act.add_run(act)

    doc.add_paragraph(
        "PARÁGRAFO ESPECIAL (Exención Ley 1493 de 2011): De conformidad con la legislación colombiana, la sociedad CLOUDTICKETS S.A.S. opera exclusivamente en calidad de Proveedor de Infraestructura Tecnológica (SaaS). La sociedad no actúa como operador de boletería ni tiquetera pública registrada en los términos de la Ley 1493 de 2011, recayendo la responsabilidad de emisión y tributación sobre los organizadores contratantes."
    )

    add_article_heading("ARTÍCULO 4º –", "DURACIÓN:")
    doc.add_paragraph(
        "El término de duración de la sociedad será INDEFINIDO, de conformidad con lo establecido en el numeral 5º del Artículo 5º de la Ley 1258 de 2008."
    )

    # CAPITULO II
    doc.add_paragraph().paragraph_format.space_before = Pt(12)
    doc.add_paragraph().add_run("CAPÍTULO II – CAPITAL SOCIAL Y ACCIONES").bold = True

    add_article_heading("ARTÍCULO 5º –", "CAPITAL AUTORIZADO, SUSCRITO Y PAGADO:")
    doc.add_paragraph(
        "El capital de la sociedad se estructura de la siguiente manera:"
    )

    cap_details = [
        ("• Capital Autorizado: ", "DIEZ MILLONES DE PESOS COLOMBIANOS M/CTE ($10.000.000 COP), dividido en 10.000 acciones ordinarias de valor nominal de UN MIL PESOS COLOMBIANOS M/CTE ($1.000 COP) cada una."),
        ("• Capital Suscrito: ", "DIEZ MILLONES DE PESOS COLOMBIANOS M/CTE ($10.000.000 COP), representado en 10.000 acciones ordinarias de valor nominal de $1.000 COP cada una."),
        ("• Capital Pagado: ", "DIEZ MILLONES DE PESOS COLOMBIANOS M/CTE ($10.000.000 COP), cancelados en su totalidad por el accionista constituyente al momento de la suscripción.")
    ]
    for title, desc in cap_details:
        p_cap = doc.add_paragraph()
        p_cap.paragraph_format.left_indent = Inches(0.2)
        p_cap.paragraph_format.space_after = Pt(3)
        p_cap.add_run(title).bold = True
        p_cap.add_run(desc)

    add_article_heading("ARTÍCULO 6º –", "COMPOSICIÓN DE ACCIONISTAS Y COMPOSICIÓN DE CAPITAL:")
    
    # Table of Capital
    table = doc.add_table(rows=2, cols=4)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False

    headers = ["Accionista", "Cédula / NIT", "No. Acciones", "Capital Pagado ($)"]
    hdr_cells = table.rows[0].cells
    for i, t_text in enumerate(headers):
        hdr_cells[i].text = t_text
        shading = parse_xml(r'<w:shd {} w:fill="0F172A"/>'.format(nsdecls('w')))
        hdr_cells[i]._tc.get_or_add_tcPr().append(shading)
        p = hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for r in p.runs:
            r.font.bold = True
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            r.font.size = Pt(9.5)

    row_cells = table.rows[1].cells
    data = ["RONNY GARCIA GALLEGO", "1.116.248.661", "10.000 (100%)", "$10.000.000 COP"]
    for i, val in enumerate(data):
        row_cells[i].text = val
        p = row_cells[i].paragraphs[0]
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.space_before = Pt(2)
        for r in p.runs:
            r.font.size = Pt(9.5)
        if i in [1, 2, 3]:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    add_article_heading("ARTÍCULO 7º –", "DERECHOS CONFERIDOS POR LAS ACCIONES:")
    doc.add_paragraph(
        "Todas las acciones en que se divide el capital de la sociedad son ordinarias, de igual valor nominativo y otorgan a su titular los derechos estipulados en el Artículo 379 del Código de Comercio y la Ley 1258 de 2008, en especial el derecho a voto en las deliberaciones de la Asamblea General de Accionistas y a recibir utilidades o dividendos."
    )

    # CAPITULO III
    doc.add_paragraph().paragraph_format.space_before = Pt(12)
    doc.add_paragraph().add_run("CAPÍTULO III – ÓRGANOS DE ADMINISTRACIÓN Y DIRECCIÓN").bold = True

    add_article_heading("ARTÍCULO 8º –", "ESTRUCTURA ORGÁNICA:")
    doc.add_paragraph(
        "La dirección, administración y representación legal de la sociedad estará a cargo de los siguientes órganos:\n"
        "1. La Asamblea General de Accionistas (órgano supremo de dirección).\n"
        "2. El Representante Legal (órgano ejecutivo de gestión y administración)."
    )
    doc.add_paragraph(
        "PARÁGRAFO: La sociedad NO tendrá Junta Directiva, asumiendo el Representante Legal la totalidad de las funciones de gestión y administración que la ley o los estatutos no reserven a la Asamblea General."
    )

    add_article_heading("ARTÍCULO 9º –", "ASAMBLEA GENERAL DE ACCIONISTAS:")
    doc.add_paragraph(
        "La Asamblea General de Accionistas la conforma el único accionista o los accionistas inscritos en el Libro de Registro de Acciones. Mientras la sociedad permanezca con accionista único, este ejercerá todas las atribuciones de la Asamblea General y sus decisiones se consignarán en actas debidamente firmadas por él."
    )

    add_article_heading("ARTÍCULO 10º –", "REPRESENTACIÓN LEGAL Y NOMBRAMIENTO:")
    doc.add_paragraph(
        "La representación legal de la sociedad CLOUDTICKETS S.A.S., su administración ejecutiva y la gestión de sus negocios estará a cargo de un REPRESENTANTE LEGAL titular, quien podrá contar con un Suplente para sus faltas absolutas, temporales o accidentales."
    )
    doc.add_paragraph(
        "Designación Inicial: Se designa como primer REPRESENTANTE LEGAL de la sociedad a:"
    )

    rep_box = doc.add_paragraph()
    rep_box.paragraph_format.left_indent = Inches(0.4)
    rep_run = rep_box.add_run(
        "• Cargo: Representante Legal Titular\n"
        "• Nombre: RONNY GARCIA GALLEGO\n"
        "• Cédula de Ciudadanía: 1.116.248.661 expedida en Tuluá\n"
        "• Período: Indefinido"
    )
    rep_run.bold = True
    rep_run.font.color.rgb = DARK_BLUE

    add_article_heading("ARTÍCULO 11º –", "FACULTADES DEL REPRESENTANTE LEGAL:")
    doc.add_paragraph(
        "El Representante Legal estará investido de las más amplias facultades para administrar, celebrar contratos, abrir y manejar cuentas bancarias, contratar personal, suscribir pasarelas de pago, apoderar abogados y representar a la sociedad judicial y extrajudicialmente sin limitación alguna por cuantía."
    )

    # CAPITULO IV
    doc.add_paragraph().paragraph_format.space_before = Pt(12)
    doc.add_paragraph().add_run("CAPÍTULO IV – ESTADOS FINANCIEROS Y DISOLUCIÓN").bold = True

    add_article_heading("ARTÍCULO 12º –", "EJERCICIO SOCIAL Y ESTADOS FINANCIEROS:")
    doc.add_paragraph(
        "El ejercicio social se cortará el 31 de diciembre de cada año. Al final de cada ejercicio, el Representante Legal elaborará los estados financieros de propósito general y el informe de gestión para sometimiento del accionista."
    )

    add_article_heading("ARTÍCULO 13º –", "DISOLUCIÓN Y LIQUIDACIÓN:")
    doc.add_paragraph(
        "La sociedad se disolverá por las causales legales previstas en el Artículo 34 de la Ley 1258 de 2008, procediéndose a su liquidación de conformidad con las normas legales vigentes."
    )

    # CONSTANCIA DE ACEPTACIÓN
    doc.add_paragraph().paragraph_format.space_before = Pt(16)
    doc.add_paragraph().add_run("ACEPTACIÓN DEL CARGO").bold = True
    doc.add_paragraph(
        "El suscrito RONNY GARCIA GALLEGO, identificado con C.C. No. 1.116.248.661 de Tuluá, manifiesta que ACEPTA la designación efectuada como REPRESENTANTE LEGAL de la sociedad CLOUDTICKETS S.A.S., comprometiéndose a desempeñar el cargo con lealtad y rectitud."
    )

    doc.add_paragraph(
        "En constancia de lo anterior, se firma el presente documento privado de constitución en dos (2) ejemplares del mismo tenor y valor legal en la ciudad de Tuluá, el día [DÍA] del mes de [MES] del año 2026."
    )

    # Signature block
    doc.add_paragraph().paragraph_format.space_before = Pt(24)
    
    sig_table = doc.add_table(rows=1, cols=1)
    sig_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    sig_table.autofit = False
    
    c_cell = sig_table.rows[0].cells[0]
    p_s = c_cell.paragraphs[0]
    p_s.add_run("_________________________________________\n").bold = True
    p_s.add_run("RONNY GARCIA GALLEGO\n").bold = True
    p_s.add_run("C.C. No. 1.116.248.661 de Tuluá\nAccionista Constituyente & Representante Legal\nCLOUDTICKETS S.A.S.")

    # Remove borders
    for row in sig_table.rows:
        for cell in row.cells:
            tcPr = cell._tc.get_or_add_tcPr()
            tcBorders = parse_xml(r'''
                <w:tcBorders {} >
                    <w:top w:val="none"/>
                    <w:left w:val="none"/>
                    <w:bottom w:val="none"/>
                    <w:right w:val="none"/>
                </w:tcBorders>
            '''.format(nsdecls('w')))
            tcPr.append(tcBorders)

    doc.save(filename)
    print(f"SAS Constitution document saved successfully at: {filename}")

if __name__ == "__main__":
    create_sas_docx(r"c:\0DE\Ticketera\ESTATUTOS_Y_DOC_CONSTITUCION_CLOUDTICKETS_SAS.docx")
