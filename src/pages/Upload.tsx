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
}

export default function Upload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

  const handleUpload = async () => {
  if (!selectedFile) return;

  setLoading(true);
  setError('');
  setResult(null);

  try {
    // Processar arquivo Excel no frontend
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    
    const arrayBuffer = await selectedFile.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('Planilha não encontrada');
    }

    // Ler CNPJ da célula G2
    const cnpjCell = worksheet.getCell('G2');
    const cnpj = cnpjCell.value?.toString().trim();

    if (!cnpj) {
      throw new Error('CNPJ não encontrado na célula G2');
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

    // Ler período da célula G3
    const periodoCell = worksheet.getCell('G3');
    const periodoStr = periodoCell.value?.toString().trim();

    if (!periodoStr) {
      throw new Error('Período não encontrado na célula G3');
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

    // Ler dados das linhas a partir da linha 8
    const balancetes = [];
    let rowNum = 8;

    // Modificado para verificar até a última linha com um número na coluna A, sem considerar "RESUMO DO BALANCETE"
    while (true) {
      const row = worksheet.getRow(rowNum);
      
      // Verificar se a célula da coluna A contém um número ou "RESUMO DO BALANCETE"
      const codigo = row.getCell('A').value?.toString().trim();
      
      // Se a célula da coluna A for vazia ou "RESUMO DO BALANCETE", parar o loop
      if (!codigo || codigo === "RESUMO DO BALANCETE") break;

      const classificacao = row.getCell('E').value?.toString().trim() || '';
      
      // Concatenar descrição das colunas I:N sem repetir as partes
      const descricaoPartes: string[] = [];
      for (let col = 9; col <= 14; col++) {
        const valor = row.getCell(col).value?.toString().trim();
        if (valor && !descricaoPartes.includes(valor)) {
          descricaoPartes.push(valor); // Adicionar apenas se não for repetido
        }
      }

      // Concatenar as partes da descrição sem repetição
      const descricao_conta = descricaoPartes.join(' > ');

      const saldo_anterior = parseFloat(row.getCell('V').value?.toString() || '0');
      const debito = parseFloat(row.getCell('Y').value?.toString() || '0');
      const credito = parseFloat(row.getCell('AC').value?.toString() || '0');
      const saldo_atual = parseFloat(row.getCell('AI').value?.toString() || '0');

      balancetes.push({
        cliente_id: cliente.id,
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        codigo: codigo.replace(/^0+/, '') || '0', // Remover zeros à esquerda
        classificacao,
        descricao_conta,  // Usando a descrição final ajustada
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

    setResult({
      message: 'Planilha importada com sucesso',
      cliente: cliente.nome,
      cnpj,
      periodo: periodoStr,
      registros: balancetes.length
    });

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
        <p className="text-gray-600 mt-1">Importe balancetes contábeis via arquivo Excel</p>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-4">Instruções para Upload</h2>
        <div className="space-y-3 text-blue-800">
          <p><strong>Estrutura da Planilha:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li><strong>G2:</strong> CNPJ do cliente (deve estar cadastrado)</li>
            <li><strong>G3:</strong> Período (formato: 01/01/2025 - 31/01/2025)</li>
            <li><strong>Linha 8 em diante:</strong> Dados dos balancetes</li>
          </ul>
          <p className="mt-4"><strong>Colunas de Dados:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li><strong>A:</strong> Código da conta</li>
            <li><strong>E:</strong> Classificação</li>
            <li><strong>I-N:</strong> Descrição da conta (hierárquica)</li>
            <li><strong>V:</strong> Saldo anterior</li>
            <li><strong>Y:</strong> Débito</li>
            <li><strong>CA:</strong> Crédito</li>
            <li><strong>AI:</strong> Saldo atual</li>
          </ul>
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