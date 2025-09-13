import React, { useState } from 'react';
import { Upload as UploadIcon, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/LoadingSpinner';

interface UploadResult {
  message: string;
  cliente: string;
  cnpj: string;
  periodo: string;
  registros: number;
  tipo: 'balancete' | 'dfc';
}

export default function Upload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<'balancete' | 'dfc'>('balancete');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
      setError('');
    }
  };

  const handleBalanceteUpload = async (workbook: any, cliente: any, periodoInicio: string, periodoFim: string, periodoStr: string) => {
    const worksheet = workbook.worksheets[0];
    
    // Ler dados das linhas a partir da linha 8
    const balancetes = [];
    let rowNum = 8;

    while (true) {
      const row = worksheet.getRow(rowNum);
      
      const codigo = row.getCell('A').value?.toString().trim();
      
      if (!codigo || codigo === "RESUMO DO BALANCETE") break;

      const classificacao = row.getCell('E').value?.toString().trim() || '';
      
      const descricaoPartes: string[] = [];
      for (let col = 9; col <= 14; col++) {
        const valor = row.getCell(col).value?.toString().trim();
        if (valor && !descricaoPartes.includes(valor)) {
          descricaoPartes.push(valor);
        }
      }

      const descricao_conta = descricaoPartes.join(' > ');

      const saldo_anterior = parseFloat(row.getCell('V').value?.toString() || '0');
      const debito = parseFloat(row.getCell('Y').value?.toString() || '0');
      const credito = parseFloat(row.getCell('AC').value?.toString() || '0');
      const saldo_atual = parseFloat(row.getCell('AI').value?.toString() || '0');

      balancetes.push({
        cliente_id: cliente.id,
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        codigo: codigo.replace(/^0+/, '') || '0',
        classificacao,
        descricao_conta,
        saldo_anterior: isNaN(saldo_anterior) ? 0 : saldo_anterior,
        debito: isNaN(debito) ? 0 : debito,
        credito: isNaN(credito) ? 0 : credito,
        saldo_atual: isNaN(saldo_atual) ? 0 : saldo_atual
      });

      rowNum++;
    }

    if (balancetes.length === 0) {
      throw new Error('Nenhum dado encontrado na planilha');
    }

    // Deletar dados existentes do mesmo período
    await supabase
      .from('balancetes')
      .delete()
      .eq('cliente_id', cliente.id)
      .eq('periodo_inicio', periodoInicio)
      .eq('periodo_fim', periodoFim);

    // Inserir novos dados
    const { error: insertError } = await supabase
      .from('balancetes')
      .insert(balancetes);

    if (insertError) {
      throw new Error('Erro ao inserir dados: ' + insertError.message);
    }

    return {
      message: 'Balancete importado com sucesso',
      cliente: cliente.nome,
      cnpj: cliente.cnpj,
      periodo: periodoStr,
      registros: balancetes.length,
      tipo: 'balancete' as const
    };
  };

  const handleDFCUpload = async (workbook: any, cliente: any, periodoInicio: string, periodoFim: string, periodoStr: string) => {
  const worksheet = workbook.worksheets[0];

  // Ler dados das linhas a partir da linha 7
  const dfcData = [];
  let rowNum = 7;

  while (true) {
    const row = worksheet.getRow(rowNum);
    
    // Verificar se a célula da coluna A contém dados ou se chegou à linha final (DISPONIBILIDADES - NO FINAL DO PERÍODO)
    const cellA = row.getCell('A').value?.toString().trim();
    if (cellA === "DISPONIBILIDADES - NO FINAL DO PERÍODO") break; // Parar quando encontrar esse texto
    
    // Se não há mais dados em A, D ou O, parar o loop (evitar loop infinito)
    if (!cellA && !row.getCell('D').value && !row.getCell('O').value) {
      break; // Termina o loop se não houver dados
    }

    // Capturar título da coluna A se existir
    const titulo = cellA || '';
    const descricao = row.getCell('D').value?.toString().trim();  // Descrição da coluna D
    const valorStr = row.getCell('O').value?.toString().trim();

if (descricao && valorStr) {
  // Remove pontos dos milhares e troca vírgula por ponto
  const valorLimpo = valorStr.replace(/\./g, '').replace(',', '.');

  // Força duas casas decimais usando toFixed
  const valor = Number.parseFloat(valorLimpo).toFixed(2);

  dfcData.push({
    cliente_id: cliente.id,
    periodo_inicio: periodoInicio,
    periodo_fim: periodoFim,
    titulo: titulo,
    descricao: descricao,
    valor: valor // valor agora é string "179487.30"
  });
}


    rowNum++; // Próxima linha
  }

  if (dfcData.length === 0) {
    throw new Error('Nenhum dado DFC encontrado na planilha');
  }

  // Deletar dados existentes do mesmo período
  await supabase
    .from('dfc')
    .delete()
    .eq('cliente_id', cliente.id)
    .eq('periodo_inicio', periodoInicio)
    .eq('periodo_fim', periodoFim);

  // Inserir novos dados
  const { error: insertError } = await supabase
    .from('dfc')
    .insert(dfcData);

  if (insertError) {
    throw new Error('Erro ao inserir dados DFC: ' + insertError.message);
  }

  return {
    message: 'DFC importado com sucesso',
    cliente: cliente.nome,
    cnpj: cliente.cnpj,
    periodo: periodoStr,
    registros: dfcData.length,
    tipo: 'dfc' as const
  };
};



  const handleUpload = async () => {
  if (!selectedFile) return;

  setLoading(true);
  setError('');
  setResult(null);

  try {
    // Verificar se o arquivo é válido
    if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      throw new Error('Formato de arquivo inválido. Use apenas arquivos .xlsx ou .xls');
    }

    // Processar arquivo Excel no frontend
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      
      // Verificar se o arrayBuffer não está vazio
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Arquivo está vazio ou corrompido');
      }
      
      await workbook.xlsx.load(arrayBuffer);
    } catch (excelError) {
      console.error('Erro ao processar Excel:', excelError);
      throw new Error('Arquivo Excel inválido ou corrompido. Verifique se o arquivo está íntegro e no formato correto (.xlsx ou .xls) e tente novamente.');
    }
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('Planilha não encontrada');
    }

    // Ler CNPJ da célula G2
    // Ler CNPJ conforme tipo de upload
    let cnpj = '';
    if (uploadType === 'balancete') {
      cnpj = worksheet.getCell('G2').value?.toString().trim() || '';
    } else { // dfc
      cnpj = worksheet.getCell('E2').value?.toString().trim() || '';
    }
    if (!cnpj) {
      throw new Error(`CNPJ não encontrado na célula ${uploadType === 'balancete' ? 'G2' : 'E3'}`);
    }


    // Verificar se cliente existe
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('*')
      .eq('cnpj', cnpj)
      .single();

    if (clienteError || !cliente) {
      throw new Error(`Cliente com CNPJ ${cnpj} não encontrado. Cadastre o cliente primeiro.`);
    }

   // Ler período conforme tipo de upload
    let periodoStr = '';
    if (uploadType === 'balancete') {
      periodoStr = worksheet.getCell('G3').value?.toString().trim() || '';
    } else { // dfc
      periodoStr = worksheet.getCell('E3').value?.toString().trim() || '';
    }
    if (!periodoStr) {
      throw new Error(`Período não encontrado na célula ${uploadType === 'balancete' ? 'G3' : 'E3'}`);
    }


    // Imprimir o valor do período para diagnóstico
    console.log('Valor do período:', periodoStr);

    // Ajustar a regex para capturar o período de forma mais flexível
    const match = periodoStr.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);

    if (!match) {
      throw new Error('Formato de período inválido. Use: DD/MM/YYYY - DD/MM/YYYY');
    }

    const [, inicioStr, fimStr] = match;
    const [diaInicio, mesInicio, anoInicio] = inicioStr.split('/').map(Number);
    const [diaFim, mesFim, anoFim] = fimStr.split('/').map(Number);

    const periodoInicio = new Date(anoInicio, mesInicio - 1, diaInicio).toISOString().split('T')[0];
    const periodoFim = new Date(anoFim, mesFim - 1, diaFim).toISOString().split('T')[0];

    // Processar baseado no tipo selecionado
    let uploadResult;
    if (uploadType === 'balancete') {
      uploadResult = await handleBalanceteUpload(workbook, cliente, periodoInicio, periodoFim, periodoStr);
    } else {
      uploadResult = await handleDFCUpload(workbook, cliente, periodoInicio, periodoFim, periodoStr);
    }

    setResult(uploadResult);

    setSelectedFile(null);
    // Reset input file
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';

  } catch (err) {
    setError(err instanceof Error ? err.message : 'Erro no upload');
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Upload de Planilhas</h1>
        <p className="text-gray-600 mt-1">Importe balancetes e DFC via arquivo Excel</p>
      </div>

      {/* Tipo de Upload */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Tipo de Arquivo</h2>
        <div className="flex space-x-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="uploadType"
              value="balancete"
              checked={uploadType === 'balancete'}
              onChange={(e) => setUploadType(e.target.value as 'balancete' | 'dfc')}
              className="mr-2"
            />
            <span className="text-gray-700">Balancete</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="uploadType"
              value="dfc"
              checked={uploadType === 'dfc'}
              onChange={(e) => setUploadType(e.target.value as 'balancete' | 'dfc')}
              className="mr-2"
            />
            <span className="text-gray-700">DFC (Demonstração dos Fluxos de Caixa)</span>
          </label>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-4">
          Instruções para Upload - {uploadType === 'balancete' ? 'Balancete' : 'DFC'}
        </h2>
        <div className="space-y-3 text-blue-800">
          <p><strong>Estrutura da Planilha:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li><strong>G2:</strong> CNPJ do cliente (deve estar cadastrado)</li>
            <li><strong>G3:</strong> Período (formato: 01/01/2025 - 31/01/2025)</li>
            <li><strong>Linha {uploadType === 'balancete' ? '8' : '7'} em diante:</strong> Dados do {uploadType}</li>
          </ul>
          {uploadType === 'balancete' ? (
            <>
              <p className="mt-4"><strong>Colunas de Dados (Balancete):</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>A:</strong> Código da conta</li>
                <li><strong>E:</strong> Classificação</li>
                <li><strong>I-N:</strong> Descrição da conta (hierárquica)</li>
                <li><strong>V:</strong> Saldo anterior</li>
                <li><strong>Y:</strong> Débito</li>
                <li><strong>AC:</strong> Crédito</li>
                <li><strong>AI:</strong> Saldo atual</li>
              </ul>
            </>
          ) : (
            <>
              <p className="mt-4"><strong>Colunas de Dados (DFC):</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>A:</strong> Título da seção</li>
                <li><strong>D:</strong> Descrição do item</li>
                <li><strong>O:</strong> Valor do item</li>
                <li><strong>Parada:</strong> Importação para em "DISPONIBILIDADES - NO FINAL DO PERÍODO"</li>
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12">
        <div className="text-center">
          <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <div className="mb-4">
            <label
              htmlFor="file-input"
              className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <UploadIcon className="h-4 w-4 mr-2" />
              Selecionar Arquivo
            </label>
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
          <p className="text-gray-600">Ou arraste e solte um arquivo Excel aqui</p>
          <p className="text-sm text-gray-500 mt-2">Apenas arquivos .xlsx e .xls são aceitos</p>
        </div>
      </div>

      {/* Selected File */}
      {selectedFile && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileSpreadsheet className="h-8 w-8 text-green-600" />
              <div>
                <p className="font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              onClick={handleUpload}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <UploadIcon className="h-4 w-4 mr-2" />
                  Processar
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Success Result */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-start">
            <CheckCircle className="h-6 w-6 text-green-600 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-lg font-semibold text-green-900">Upload Concluído!</h3>
              <div className="mt-2 space-y-1 text-green-800">
                <p><strong>Cliente:</strong> {result.cliente}</p>
                <p><strong>CNPJ:</strong> {result.cnpj}</p>
                <p><strong>Período:</strong> {result.periodo}</p>
                <p><strong>Registros importados:</strong> {result.registros}</p>
                <p><strong>Tipo:</strong> {result.tipo === 'balancete' ? 'Balancete' : 'DFC'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertCircle className="h-6 w-6 text-red-600 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-lg font-semibold text-red-900">Erro no Upload</h3>
              <p className="mt-2 text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}