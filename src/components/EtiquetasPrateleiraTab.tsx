import React, { useState, useRef } from 'react';
import { Tag, UploadCloud, Download, Trash2, Search, Printer, AlertTriangle, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, VerticalAlign, BorderStyle, ShadingType, HeightRule, PageBreak } from "docx";

// Dicionário de Tall Man Lettering para Medicamentos LASA (Look-Alike, Sound-Alike) baseado no ISMP Brasil e ISMP USA
const tallManDictionary: Record<string, string> = {
  // ISMP Brasil list
  'ABCIXIMABE': 'ABCIXimabe',
  'ACICLOVIR': 'Aciclovir',
  'ÁCIDO FÓLICO': 'Ácido Fólico',
  'ACIDO FOLICO': 'Ácido Fólico',
  'ÁCIDO FOLÍNICO': 'Ácido FolÍNico',
  'ACIDO FOLINICO': 'Ácido FolÍNico',
  'ADALIMUMABE': 'ADALImumabe',
  'ALENTUZUMABE': 'ALENTUzumabe',
  'ALFENTANILA': 'ALfentanila',
  'ALOPURINOL': 'AloPURinol',
  'AMINOFILINA': 'AmiNOFILina',
  'AMIODARONA': 'AmioDARONA',
  'AMITRIPTILINA': 'AmiTRIPtilina',
  'AZATIOPRINA': 'AzaTIOprina',
  'AZITROMICINA': 'AZITromicina',
  'BASILIXIMABE': 'BASILiximabe',
  'BETAMETASONA': 'BETAmetasona',
  'BEVACIZUMABE': 'BEVACizumabe',
  'BROMOCRIPTINA': 'BromoCRIPTINA',
  'BROMOPRIDA': 'BromoPRIDA',
  'BUPIVACAÍNA': 'BUpivacaína',
  'BUPIVACAINA': 'BUpivacaína',
  'BUPROPIONA': 'BuPROPiona',
  'BUSPIRONA': 'BusPIRona',
  'CABAZITAXEL': 'CaBAZitaxel',
  'CALCITRIOL': 'CalciTRIOL',
  'CARBAMAZEPINA': 'CarBAMazepina',
  'CARBOPLATINA': 'CARBOplatina',
  'CARVEDILOL': 'CarVEDilol',
  'CEFOTAXIMA': 'CefOTAXima',
  'CEFALOTINA': 'CefaLOTina',
  'CEFAZOLINA': 'CeFAZolina',
  'CEFOXITINA': 'CefOXitina',
  'CEFTAZIDIMA': 'CefTAZidima',
  'CEFTRIAXONA': 'CefTRIAXona',
  'CETUXIMABE': 'CETuximabe',
  'CICLOFOSFAMIDA': 'CicloFOSFAMida',
  'CICLOSPORINA': 'CiclosPORINA',
  'CISPLATINA': 'CISplatina',
  'CITALOPRAM': 'Citalopram',
  'CLOMIPRAMINA': 'ClomiPRAMINA',
  'CLONIDINA': 'CloNIDina',
  'CLORPROMAZINA': 'ClorproMAZINA',
  'CLORPROPAMIDA': 'ClorproPAMIDA',
  'CLOZAPINA': 'CloZAPina',
  'DACLIZUMABE': 'DACLizumabe',
  'DACTINOMICINA': 'DACTINomicina',
  'DAPTOMICINA': 'DAPTOmicina',
  'DASATINIBE': 'DASAtinibe',
  'DAUNORRUBICINA': 'DAUNOrrubicina',
  'DECITABINA': 'DECitabina',
  'DESMOPRESSINA': 'DESMopressina',
  'DEXAMETASONA': 'DEXAmetasona',
  'DIPIRIDAMOL': 'DipiRIDAMOL',
  'DIPIRONA': 'DipiRONA',
  'DOBUTAMINA': 'DOBUTamina',
  'DOCETAXEL': 'DOCEtaxel',
  'DOPAMINA': 'DOPamina',
  'DOXORRUBICINA': 'DOXOrrubicina',
  'DULOXETINA': 'DULoxetina',
  'EFEDRINA': 'EFEDrina',
  'EPINEFRINA': 'EPINEFrina',
  'EPIRRUBICINA': 'EPIrrubicina',
  'ESCITALOPRAM': 'ESCitalopram',
  'ESTREPTOMICINA': 'EstreptoMICINA',
  'ESTREPTOQUINASE': 'EstreptoQUINASE',
  'ETILEFRINA': 'ETILEfrina',
  'FENILEFRINA': 'FENILEFrina',
  'FENTANILA': 'FentaNILA',
  'FLUOXETINA': 'FLUoxetina',
  'GANCICLOVIR': 'GANciclovir',
  'GENCITABINA': 'GENCITabina',
  'GENTAMICINA': 'GENTAmicina',
  'GLICLAZIDA': 'GliCLAZida',
  'GLIMEPIRIDA': 'GliMEPIRida',
  'HALOPERIDOL': 'HaloPERidol',
  'HIDRALAZINA': 'HidrALAZINA',
  'HIDROCLOROTIAZIDA': 'HidroCLOROTiazida',
  'IDARRUBICINA': 'IDArrubicina',
  'INFLIXIMABE': 'InFLIXimabe',
  'IPRATRÓPIO': 'IPRAtrópio',
  'IPRATROPIO': 'IPRAtrópio',
  'LAPATINIBE': 'LAPAtinibe',
  'LEVOBUPIVACAÍNA': 'LEVOBupivacaína',
  'LEVOBUPIVACAINA': 'LEVOBupivacaína',
  'LEVOMEPROMAZINA': 'LevoMEPROmazina',
  'LEVOTIROXINA': 'LevoTIROXina',
  'METOTREXATO': 'MetoTREXATO',
  'MITOMICINA': 'MitoMIcina',
  'MITOXANTRONA': 'MitoXANtrona',
  'MOXIFLOXACINO': 'MOXifloxacino',
  'NIFEDIPINO': 'NiFEDipino',
  'NIMODIPINO': 'NiMODipino',
  'NITROGLICERINA': 'NitroGLICERINA',
  'NITROPRUSSIATO': 'NitroPRUSSIATO',
  'NOREPINEFRINA': 'NOREPinefrina',
  'NORFLOXACINO': 'NORfloxacino',
  'NORTRIPTILINA': 'NORTriptilina',
  'OLANZAPINA': 'OLANZapina',
  'OXALIPLATINA': 'OXALiplatina',
  'OXCARBAZEPINA': 'OXcarbazepina',
  'PACLITAXEL': 'PACLitaxel',
  'PENICILINA G BENZATINA': 'Penicilina G BENZATINA',
  'PENICILINA G CRISTALINA': 'Penicilina G CRISTALINA',
  'PIOGLITAZONA': 'PIOglitazona',
  'PREDNISOLONA': 'PrednisoLONA',
  'PREDNISONA': 'PredniSONA',
  'QUETIAPINA': 'QUEtiapina',
  'RIFAMICINA': 'RifaMICina',
  'RIFAMPICINA': 'RifAMPICina',
  'RITUXIMABE': 'RiTUXimabe',
  'ROPIVACAÍNA': 'ROpivacaína',
  'ROPIVACAINA': 'ROpivacaína',
  'ROSIGLITAZONA': 'ROSiglitazona',
  'SORAFENIBE': 'SORAfenibe',
  'SUFENTANILA': 'SUFentanila',
  'SULFADIAZINA': 'SulfADIAZINA',
  'SULFASSALAZINA': 'SulfaSSALAzina',
  'SUNITINIBE': 'SUNItinibe',
  'TIOTRÓPIO': 'TIOtrópio',
  'TIOTROPIO': 'TIOtrópio',
  'TRASTUZUMABE': 'TRAStuzumabe',
  'VALACICLOVIR': 'ValACIclovir',
  'VALGANCICLOVIR': 'ValGANCiclovir',
  'VASOPRESSINA': 'VASopressina',
  'VIMBLASTINA': 'VimBLAStina',
  'VINCRISTINA': 'VinCRIStina',
  'VINORELBINA': 'VinORELBina',
  // ISMP USA additions
  'ACETAZOLAMIDE': 'acetaZOLAMIDE',
  'ACETOHEXAMIDE': 'acetoHEXAMIDE',
  'ALPRAZOLAM': 'ALPRAZolam',
  'AMLODIPINE': 'amLODIPine',
  'AMILORIDE': 'aMILoride',
  'ARIPIPRAZOLE': 'ARIPiprazole',
  'AZACITIDINE': 'azaCITIDine',
  'AZATHIOPRINE': 'azaTHIOprine',
  'BUPRENORPHINE': 'buprenorphine',
  'CHLORDIAZEPOXIDE': 'chlordiazePOXIDE',
  'CLOBAZAM': 'cloBAZam',
  'CLOMIPHENE': 'clomiPHENE',
  'CLONAZEPAM': 'clonazePAM',
  'DEXAMETHASONE': 'dexAMETHasone',
  'DEXMEDETOMIDINE': 'dexmedeTOMIDine',
  'DIAZEPAM': 'diazePAM',
  'DILTIAZEM': 'dilTIAZem',
  'DIMENHYDRINATE': 'dimenhyDRINATE',
  'DIPHENHYDRAMINE': 'diphenhydrAMINE',
  'DRONABINOL': 'droNABinol',
  'DROPERIDOL': 'droPERidol',
  'ERIBULIN': 'eriBULin',
  'FLAVOXATE': 'flavoxATE',
  'FLUVOXAMINE': 'fluvoxaMINE',
  'FLUPHENAZINE': 'fluPHENAZine',
  'GUAIFENESIN': 'guaiFENesin',
  'GUANFACINE': 'guanFACINE',
  'HYDRALAZINE': 'hydrALAZINE',
  'HYDROXYCHLOROQUINE': 'hydroxychloroquine',
  'HYDROXYZINE': 'hydrOXYzine',
  'HYDROCODONE': 'HYDROcodone',
  'HYDROMORPHONE': 'HYDROmorphone',
  'KETAMINE': 'ketamine',
  'KETOROLAC': 'ketorolac',
  'LAMIVUDINE': 'lamiVUDine',
  'LAMOTRIGINE': 'lamoTRIgine',
  'LEVETIRACETAM': 'levETIRAcetam',
  'LEVOCARNITINE': 'levOCARNitine',
  'LEVOFLOXACIN': 'levoFLOXacin',
  'LEVOLEUCOVORIN': 'LEVOleucovorin',
  'LINACLOTIDE': 'linaCLOtide',
  'LINAGLIPTIN': 'linaGLIPtin',
  'MEDROXYPROGESTERONE': 'medroxyPROGESTERone',
  'METFORMIN': 'metFORMIN',
  'METHAZOLAMIDE': 'methazolAMIDE',
  'METHIMAZOLE': 'methIMAzole',
  'METOLAZONE': 'metOLazone',
  'METYRAPONE': 'metyraPONE',
  'METYROSINE': 'metyroSINE',
  'MIFEPRISTONE': 'miFEPRIStone',
  'MISOPROSTOL': 'miSOPROStol',
  'MIGALASTAT': 'migALAstat',
  'MIGLUSTAT': 'migLUstat',
  'NICARDIPINE': 'niCARdipine',
  'OXYBUTYNIN': 'oxyBUTYnin',
  'OXYCODONE': 'oxyCODONE',
  'OXYMORPHONE': 'oxyMORphone',
  'PAZOPANIB': 'PAZOPanib',
  'PENICILLAMINE': 'penicillAMINE',
  'PENTOBARBITAL': 'PENTobarbital',
  'PHENOBARBITAL': 'PHENobarbital',
  'PHYSOSTIGMINE': 'PHYSostigmine',
  'PRALIDOXIME': 'pralidoxime',
  'PYRIDOSTIGMINE': 'pyRIDostigmine',
  'QUINIDINE': 'quiNIDine',
  'QUININE': 'quiNINE',
  'RANITIDINE': 'raNITIdine',
  'RIMANTADINE': 'riMANTAdine',
  'RABEPRAZOLE': 'RABEprazole',
  'RISPERIDONE': 'risperiDONE',
  'ROMIDEPSIN': 'romiDEPsin',
  'ROMIPLOSTIM': 'romiPLOStim',
  'ROPINIROLE': 'rOPINIRole',
  'SAXAGLIPTIN': 'sAXagliptin',
  'SITAGLIPTIN': 'SITagliptin',
  'SUMATRIPTAN': 'SUMAtriptan',
  'ZOLMITRIPTAN': 'ZOLMitriptan',
  'TIZANIDINE': 'tiZANidine',
  'TIAGABINE': 'tiaGABine',
  'TOLAZAMIDE': 'TOLAZamide',
  'TOLBUTAMIDE': 'TOLBUTamide',
  'TRAZODONE': 'traZODone',
  'TRAMADOL': 'traMADol',
};

const applyTallMan = (text: string) => {
  let formattedText = text.toUpperCase();
  
  // Ordena as chaves da maior para a menor para evitar que parte de uma palavra maior
  // seja substituída equivocadamente por uma menor (ex: evitar substituir apenas FENTANILA em ALFENTANILA)
  const keys = Object.keys(tallManDictionary).sort((a, b) => b.length - a.length);

  keys.forEach(key => {
    // Regex flexível: ($|[^A-Za-zÀ-ÿ])
    // Grupos para mantermos a consistência da palavra, substituindo apenas a exata compatibilidade.
    // O $1 captura o que tiver antes (espaço, etc) e preserva.
    const regex = new RegExp(`(^|[^A-Za-zÀ-ÿ])${key}(?=[^A-Za-zÀ-ÿ]|$)`, 'gi');
    formattedText = formattedText.replace(regex, `$1${tallManDictionary[key]}`);
  });

  return formattedText;
};

const parseCSVLine = (line: string) => {
  const result = [];
  let curVal = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) {
      result.push(curVal);
      curVal = '';
    } else {
      curVal += char;
    }
  }
  result.push(curVal);
  return result;
};

interface LabelItem {
  id: string;
  codigo: string;
  produto: string;
  unidade: string;
  produtoFormatado: string;
}

export default function EtiquetasPrateleiraTab() {
  const [data, setData] = useState<LabelItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [rollWidth, setRollWidth] = useState<number>(33);
  const [rollHeight, setRollHeight] = useState<number>(22);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processCSV = (text: string) => {
    try {
      const lines = text.split(/\r?\n/);
      const itemsMap = new Map<string, LabelItem>();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('Produto')) continue;

        const row = parseCSVLine(line);
        const codigo = row[1]?.trim();
        const produtoRaw = row[2]?.trim();
        const unidade = row[4]?.trim();

        if (codigo && produtoRaw) {
          if (itemsMap.has(codigo)) {
            const existing = itemsMap.get(codigo)!;
            // Evitar duplicar o mesmo nome se ele aparecer em várias linhas (lotes)
            if (!existing.produto.includes(produtoRaw)) {
              existing.produto = `${existing.produto} ${produtoRaw}`.trim();
              existing.produtoFormatado = applyTallMan(existing.produto);
            }
            if (unidade && !existing.unidade) {
              existing.unidade = unidade;
            }
          } else {
            itemsMap.set(codigo, {
              id: `${codigo}-${i}`,
              codigo: codigo,
              produto: produtoRaw,
              unidade: unidade || '',
              produtoFormatado: applyTallMan(produtoRaw)
            });
          }
        }
      }

      const parsedData = Array.from(itemsMap.values());

      if (parsedData.length === 0) {
        throw new Error('Nenhum produto válido encontrado no arquivo.');
      }

      setData(parsedData.sort((a, b) => a.produto.localeCompare(b.produto)));
      setError('');
    } catch (err: any) {
      setError(err.message || 'Erro ao processar arquivo CSV.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        processCSV(event.target?.result as string);
      };
      reader.readAsText(file, 'ISO-8859-1');
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        processCSV(event.target?.result as string);
      };
      reader.readAsText(file, 'ISO-8859-1');
    } else {
      setError('Por favor, arraste um arquivo CSV válido.');
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const margin = 12; // Margem um pouco maior para segurança
    const cols = 2;
    const rowsPerPage = 5; // Forçar 5 linhas por página para evitar cortes
    const gapX = 8;
    const gapY = 6;
    
    const labelWidth = (pageWidth - (margin * 2) - gapX) / cols;
    const labelHeight = (pageHeight - (margin * 2) - (gapY * (rowsPerPage - 1))) / rowsPerPage;
    const padding = 5;

    const filteredData = data.filter(item => 
      item.produto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.codigo.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filteredData.forEach((item, index) => {
      const itemsPerPage = cols * rowsPerPage;
      const pageIndex = Math.floor(index / itemsPerPage);
      const itemInPageIndex = index % itemsPerPage;
      const col = itemInPageIndex % cols;
      const row = Math.floor(itemInPageIndex / cols);

      if (index > 0 && itemInPageIndex === 0) {
        doc.addPage();
      }

      // Desenhar guias de corte na página (apenas uma vez por página)
      if (itemInPageIndex === 0) {
        doc.setDrawColor(220, 220, 220); // Cinza claro
        doc.setLineWidth(0.1);
        
        // Linhas verticais de guia
        [margin, margin + labelWidth, margin + labelWidth + gapX, margin + 2 * labelWidth + gapX].forEach(lx => {
          doc.line(lx, 0, lx, pageHeight);
        });

        // Linhas horizontais de guia
        for (let r = 0; r < rowsPerPage; r++) {
          const yTop = margin + r * (labelHeight + gapY);
          const yBottom = yTop + labelHeight;
          doc.line(0, yTop, pageWidth, yTop);
          doc.line(0, yBottom, pageWidth, yBottom);
        }
      }

      const x = margin + (col * (labelWidth + gapX));
      const y = margin + (row * (labelHeight + gapY));

      // Fundo
      if (theme === 'dark') {
        doc.setFillColor(0, 0, 0);
        doc.setTextColor(255, 255, 255);
      } else {
        doc.setFillColor(255, 255, 255);
        doc.setTextColor(0, 0, 0);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
      }
      doc.rect(x, y, labelWidth, labelHeight, theme === 'dark' ? 'F' : 'FD');
      
      // Código (Canto superior esquerdo)
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(`CÓD: ${item.codigo}`, x + padding, y + padding + 1);

      // Nome do Produto (Centralizado)
      let fontSize = 14;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize);
      
      let splitTitle = doc.splitTextToSize(item.produtoFormatado, labelWidth - (padding * 2));
      
      // Ajuste dinâmico de fonte
      while ((splitTitle.length * (fontSize * 0.6) > labelHeight - 15) && fontSize > 6) {
        fontSize -= 0.5;
        doc.setFontSize(fontSize);
        splitTitle = doc.splitTextToSize(item.produtoFormatado, labelWidth - (padding * 2));
      }
      
      // Centralizar verticalmente o título
      const lineHeight = fontSize * 0.6;
      const titleHeight = splitTitle.length * lineHeight;
      const titleY = y + (labelHeight / 2) - (titleHeight / 2) + (lineHeight / 2);
      
      doc.text(splitTitle, x + (labelWidth / 2), titleY, { align: 'center' });
    });

    doc.save('etiquetas_prateleira_lasa.pdf');
  };

  const exportRollPDF = () => {
    // Usar o construtor com argumentos posicionais para maior compatibilidade com tamanhos customizados
    // Orientação automática com base no tamanho maior
    const orientation = rollWidth > rollHeight ? 'l' : 'p';
    const doc = new jsPDF(orientation, 'mm', [rollWidth, rollHeight]);

    const filteredData = data.filter(item => 
      item.produto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.codigo.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filteredData.forEach((item, index) => {
      if (index > 0) {
        doc.addPage([rollWidth, rollHeight], orientation);
      }

      // Obter dimensões reais da página atual para garantir cobertura total
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const padding = 1.5;

      // Fundo - Cobrindo 100% da página independente de margens
      if (theme === 'dark') {
        doc.setFillColor(0, 0, 0);
        doc.setTextColor(255, 255, 255);
      } else {
        doc.setFillColor(255, 255, 255);
        doc.setTextColor(0, 0, 0);
      }
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      // Código (Canto superior esquerdo)
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text(`CÓD: ${item.codigo}`, padding, 4);

      // Nome do Produto (Centralizado)
      let fontSize = 11;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize);
      
      let splitTitle = doc.splitTextToSize(item.produtoFormatado, pageWidth - (padding * 2));
      
      // Cálculo de altura (1pt = 0.3527mm)
      const getTitleHeight = (fSize: number, lines: string[]) => lines.length * (fSize * 0.3527 * 1.2);

      while (getTitleHeight(fontSize, splitTitle) > (pageHeight - 9) && fontSize > 4.5) {
        fontSize -= 0.5;
        doc.setFontSize(fontSize);
        splitTitle = doc.splitTextToSize(item.produtoFormatado, pageWidth - (padding * 2));
      }
      
      const titleHeight = getTitleHeight(fontSize, splitTitle);
      const titleY = (pageHeight / 2) - (titleHeight / 2) + (fontSize * 0.3527);
      
      doc.text(splitTitle, pageWidth / 2, titleY, { align: 'center' });
    });

    doc.save(`etiquetas_rolo_${rollWidth}x${rollHeight}.pdf`);
  };

  const exportWord = async () => {
    const filteredData = data.filter(item => 
      item.produto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.codigo.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const rows = [];
    const cols = 2; // For A4

    for (let i = 0; i < filteredData.length; i += cols) {
      const rowCells = [];
      
      for (let j = 0; j < cols; j++) {
        const item = filteredData[i + j];
        if (item) {
          rowCells.push(
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: { top: 300, bottom: 300, left: 300, right: 300 },
              shading: theme === 'dark' 
                ? { fill: "000000", type: ShadingType.CLEAR, color: "auto" }
                : { fill: "FFFFFF", type: ShadingType.CLEAR, color: "auto" },
              verticalAlign: VerticalAlign.CENTER,
              borders: {
                 top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                 bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                 left: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                 right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ 
                      text: `CÓD: ${item.codigo}`, 
                      color: theme === 'dark' ? "94A3B8" : "64748B", 
                      size: 16 // 8pt
                    })
                  ],
                  spacing: { after: 200 }
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ 
                      text: item.produtoFormatado, 
                      color: theme === 'dark' ? "FFFFFF" : "000000", 
                      size: 24, // 12pt
                      bold: true
                    })
                  ]
                })
              ]
            })
          );
        } else {
            // Emtpy cell
            rowCells.push(
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: {
                    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                  },
                  children: [new Paragraph("")]
                })
            )
        }
      }
      
      rows.push(new TableRow({ children: rowCells, height: { value: 1800, rule: HeightRule.EXACT } })); // ~1800 twips ~ 3cm
    }

    const docxApp = new Document({
      sections: [{
        properties: {},
        children: [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: rows,
          })
        ],
      }]
    });

    try {
        const blob = await Packer.toBlob(docxApp);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.href = url;
        a.download = "etiquetas_prateleira_lasa_A4.docx";
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch(e) {
        console.error(e);
        setError('Erro ao gerar documento Word.');
    }
  };

  const exportRollWord = async () => {
    const filteredData = data.filter(item => 
      item.produto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.codigo.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Converte milímetros para twips (1 mm ≈ 56.7 twips)
    const twipWidth = Math.round(rollWidth * 56.6929);
    const twipHeight = Math.round(rollHeight * 56.6929);
    
    // Deixamos um espaço de 50 twips no final da página para impedir que o parágrafo de quebra crie uma página a mais
    const rowHeightValue = Math.max(100, twipHeight - 50); 
    const marginSize = 60; // Margem interna pequena para aproveitar espaço

    const children: any[] = [];

    filteredData.forEach((item, index) => {
      // Tamanho de fonte dinâmico dependendo do tamanho do texto para "preencher o quadradinho"
      const textLen = item.produtoFormatado.length;
      let titleFontSize = 40; // 20pt base
      if (textLen > 25) titleFontSize = 32; // 16pt
      if (textLen > 40) titleFontSize = 24; // 12pt

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
             top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
             bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
             left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
             right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          },
          rows: [
            new TableRow({
              height: { value: rowHeightValue, rule: HeightRule.EXACT },
              children: [
                new TableCell({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  margins: { top: marginSize, bottom: marginSize, left: marginSize, right: marginSize },
                  shading: theme === 'dark' 
                    ? { fill: "000000", type: ShadingType.CLEAR, color: "auto" }
                    : { fill: "FFFFFF", type: ShadingType.CLEAR, color: "auto" },
                  verticalAlign: VerticalAlign.CENTER,
                  borders: {
                     top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                     bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                     left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                     right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                  },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ 
                          text: `CÓD: ${item.codigo}`, 
                          color: theme === 'dark' ? "8CA8C4" : "445B73", 
                          size: 16, // 8pt
                          font: "Helvetica"
                        })
                      ],
                      spacing: { after: 100 } // Espaço entre o código e o nome
                    }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({ 
                          text: item.produtoFormatado, 
                          color: theme === 'dark' ? "FFFFFF" : "000000", 
                          size: titleFontSize, // dinâmico
                          bold: true,
                          font: "Helvetica"
                        })
                      ]
                    })
                  ]
                })
              ]
            })
          ],
        })
      );
      
      // Page break super pequeno para não gerar páginas em branco alternadas (o que ocorre se for muito grande)
      if (index < filteredData.length - 1) {
        children.push(new Paragraph({
          children: [new PageBreak()],
          spacing: { before: 0, after: 0, line: 1 }
        }));
      }
    });

    const docxApp = new Document({
      sections: [{
        properties: {
          page: {
            size: { width: twipWidth, height: twipHeight },
            margin: { top: 0, right: 0, bottom: 0, left: 0 } // remove external margins
          }
        },
        children: children,
      }]
    });

    try {
        const blob = await Packer.toBlob(docxApp);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.href = url;
        a.download = `etiquetas_rolo_${rollWidth}x${rollHeight}.docx`;
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch(e) {
        console.error(e);
        setError('Erro ao gerar documento Word.');
    }
  };

  const filteredData = data.filter(item => 
    item.produto.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Tag className="text-purple-600" />
              Gerador de Etiquetas de Prateleira (LASA)
            </h2>
            <p className="text-slate-500">Gere etiquetas com Tall Man Lettering para identificação segura.</p>
          </div>
          <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
            
            <div className="flex items-center gap-2 font-mono text-sm bg-slate-50 px-2 py-1.5 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-bold ml-1">Rolo:</span>
              <input 
                type="number" 
                value={rollWidth} 
                onChange={(e) => setRollWidth(Number(e.target.value) || 33)}
                className="w-12 text-center bg-white border border-slate-300 rounded focus:outline-none focus:border-purple-500"
                title="Largura (mm)"
              />
              <span className="text-slate-400">x</span>
              <input 
                type="number" 
                value={rollHeight} 
                onChange={(e) => setRollHeight(Number(e.target.value) || 22)}
                className="w-12 text-center bg-white border border-slate-300 rounded focus:outline-none focus:border-purple-500"
                title="Altura (mm)"
              />
              <span className="text-slate-500 mr-1">mm</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setTheme('dark')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${theme === 'dark' ? 'bg-black text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Fundo Preto
                </button>
                <button
                  onClick={() => setTheme('light')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${theme === 'light' ? 'bg-white text-slate-800 shadow-md border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Fundo Branco
                </button>
              </div>
            </div>
            
            {data.length > 0 && (
              <div className="flex flex-wrap items-center justify-end gap-2 w-full md:w-auto">
                <button 
                  onClick={() => setData([])}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-all border border-red-100"
                >
                  <Trash2 size={18} />
                  Limpar
                </button>
                <button 
                  onClick={exportPDF}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all border border-slate-200 whitespace-nowrap"
                >
                  <Printer size={18} />
                  A4 (PDF)
                </button>
                <button 
                  onClick={exportWord}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-all border border-blue-200 whitespace-nowrap"
                >
                  <FileText size={18} />
                  A4 (Word)
                </button>
                <button 
                  onClick={exportRollPDF}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 whitespace-nowrap"
                >
                  <Printer size={18} />
                  Rolo {rollWidth}x{rollHeight} (PDF)
                </button>
                <button 
                  onClick={exportRollWord}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 whitespace-nowrap"
                >
                  <FileText size={18} />
                  Rolo {rollWidth}x{rollHeight} (Word)
                </button>
              </div>
            )}
          </div>
        </div>

        {data.length === 0 ? (
          <div 
            className={`border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer
              ${isDragging ? 'border-purple-500 bg-purple-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv"
              className="hidden"
            />
            <div className="bg-white p-4 rounded-full shadow-sm mb-4">
              <UploadCloud className="w-10 h-10 text-purple-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-1">Importe o CSV de Produtos</h3>
            <p className="text-slate-500 text-sm">Arraste ou clique para selecionar o arquivo</p>
            {error && (
              <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-100 text-sm">
                <AlertTriangle size={16} />
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                type="text"
                placeholder="Pesquisar produto para etiqueta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredData.map((item) => (
                <div key={item.id} className={`${theme === 'dark' ? 'bg-black border-slate-800' : 'bg-white border-slate-300 shadow-sm'} p-4 rounded-lg border  flex flex-col justify-between h-32 relative overflow-hidden`}>
                  <div className="flex justify-between items-start z-10">
                    <span className={`text-[10px] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'} font-mono`}>CÓD: {item.codigo}</span>
                  </div>
                  
                  <div className="flex-1 flex items-center justify-center z-10">
                    <h3 className={`${theme === 'dark' ? 'text-white' : 'text-black'} font-bold text-center text-lg leading-tight`}>
                      {item.produtoFormatado}
                    </h3>
                  </div>

                  {/* Efeito de brilho sutil */}
                  {theme === 'dark' && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent opacity-20"></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-3">
        <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
        <div className="text-sm text-amber-800">
          <p className="font-bold mb-1">Sobre o Padrão LASA (Tall Man Lettering):</p>
          <p>As etiquetas utilizam letras maiúsculas em partes específicas dos nomes para diferenciar medicamentos com grafia ou som semelhantes, reduzindo erros de seleção na prateleira. O fundo preto garante alto contraste (recomendado), mas você também pode optar pela versão convencional de fundo branco.</p>
        </div>
      </div>
    </div>
  );
}
