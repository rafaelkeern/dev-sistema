import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, TrendingUp, Filter, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/LoadingSpinner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface Cliente {
  id: number;
  nome: string;
  cnpj: string;
  _count: {
    balancetes: number;
  };
}

interface Balancete {
  id: number;
  codigo: string;
  classificacao: string;
  descricao_conta: string;
  saldo_anterior: number;
  debito: number;
  credito: number;
  saldo_atual: number;
  periodo_inicio: string;
  periodo_fim: string;
}

interface ResumoPerido {
  periodo_inicio: string;
  periodo_fim: string;
  saldo_anterior: number;
  debito: number;
  credito: number;
  saldo_atual: number;
}

export default function ClienteDetalhes() {
  const { id } = useParams<{ id: string }>();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [balancetes, setBalancetes] = useState<Balancete[]>([]);
  const [resumos, setResumos] = useState<ResumoPerido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filtros, setFiltros] = useState({
    dataInicio: '',
    dataFim: ''
  });

  useEffect(() => {
    if (id) {
      fetchClienteDetalhes();
      fetchBalancetes();
      fetchResumos();
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchBalancetes();
    }
  }, [currentPage, filtros]);

  const fetchClienteDetalhes = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select(`
          *,
          balancetes:balancetes(count)
        `)
        .eq('id', id)
        .single();

      if (error || !data) {
        throw new Error('Cliente não encontrado');
      }

      // Processar dados para incluir contagem
      const processedCliente = {
        ...data,
        _count: {
          balancetes: data.balancetes?.[0]?.count || 0
        }
      };

      setCliente(processedCliente);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar cliente');
    }
  };

  const fetchBalancetes = async () => {
  try {
    let query = supabase
      .from('balancetes')
      .select('*')
      .eq('cliente_id', id)
      .order('periodo_inicio', { ascending: true });  // Ordena pela data de início (mais antiga primeiro)

    // Aplicar filtros de data
    if (filtros.dataInicio) {
      query = query.gte('periodo_inicio', filtros.dataInicio);
    }
    if (filtros.dataFim) {
      query = query.lte('periodo_fim', filtros.dataFim);
    }

    // Remover a lógica de limitação e offset
    const { data, error, count } = await query;

    if (error) {
      throw new Error('Erro ao carregar balancetes');
    }

    // Ordenação personalizada: por mês e ano (considerando 'periodo_inicio')
    const sortedData = (data || []).sort((a: any, b: any) => {
      const [mesA, anoA] = a.periodo_inicio.split('/').reverse();  // Pegando o mês e ano
      const [mesB, anoB] = b.periodo_inicio.split('/').reverse();  // Pegando o mês e ano

      // Comparando primeiro ano e depois mês
      if (anoA !== anoB) return parseInt(anoA) - parseInt(anoB);
      return parseInt(mesA) - parseInt(mesB);
    });

    setBalancetes(sortedData);
    setTotalPages(1);  // Como você quer exibir todos os dados na primeira página, define totalPages como 1
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Erro ao carregar balancetes');
  }
};




  const fetchResumos = async () => {
    try {
      const { data, error } = await supabase
        .from('balancetes')
        .select('periodo_inicio, periodo_fim, saldo_anterior, debito, credito, saldo_atual')
        .eq('cliente_id', id)
        .order('periodo_inicio', { ascending: false });

      if (error) {
        throw new Error('Erro ao carregar resumos');
      }

      // Sem agrupamento, apenas define os dados diretamente
      setResumos(data || []);
    } catch (err) {
      console.error('Erro ao carregar resumos:', err);
    } finally {
      setLoading(false);
    }
  };


  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const handleFiltroChange = (field: keyof typeof filtros, value: string) => {
    setFiltros(prev => ({ ...prev, [field]: value }));
    setCurrentPage(1);
  };

  if (loading) {
    return <LoadingSpinner text="Carregando detalhes do cliente..." />;
  }

  if (error) {
    return (
      <div className="text-center">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          {error}
        </div>
        <Link
          to="/clientes"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Clientes
        </Link>
      </div>
    );
  }

  if (!cliente) {
    return <div>Cliente não encontrado</div>;
  }

  // Preparar dados para gráficos
  const chartData = resumos.map(resumo => ({
    periodo: formatDate(resumo.periodo_inicio),
    debitos: resumo.debito || 0,
    creditos: resumo.credito || 0,
    saldo: resumo.saldo_atual || 0
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/clientes"
            className="p-2 text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{cliente.nome}</h1>
            <p className="text-gray-600">CNPJ: {cliente.cnpj}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            {cliente._count.balancetes} balancetes
          </span>
        </div>
      </div>

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Débitos e Créditos */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Débitos vs Créditos por Período
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar dataKey="debitos" fill="#EF4444" name="Débitos" />
                <Bar dataKey="creditos" fill="#10B981" name="Créditos" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Evolução do Saldo */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Evolução do Saldo
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Line
                  type="monotone"
                  dataKey="saldo"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  name="Saldo"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Filter className="h-5 w-5 mr-2" />
          Filtros
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Início
            </label>
            <input
              type="date"
              value={filtros.dataInicio}
              onChange={(e) => handleFiltroChange('dataInicio', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Fim
            </label>
            <input
              type="date"
              value={filtros.dataFim}
              onChange={(e) => handleFiltroChange('dataFim', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFiltros({ dataInicio: '', dataFim: '' });
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de Balancetes */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Balancetes Detalhados</h3>
        </div>

        {balancetes.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Nenhum balancete encontrado</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Código
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Descrição
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Classificação {/* Adiciona a coluna 'Classificação' */}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Período
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Saldo Anterior
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Débito
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Crédito
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Saldo Atual
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {balancetes.map((balancete) => (
                    <tr key={balancete.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {balancete.codigo}
                        </div>
                        <div className="text-sm text-gray-500">
                          {balancete.classificacao} {/* Exibe a classificação */}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate">
                          {balancete.descricao_conta}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {balancete.classificacao} {/* Exibe a classificação */}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(balancete.periodo_inicio)} - {formatDate(balancete.periodo_fim)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-900">
                          {formatCurrency(balancete.saldo_anterior)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-red-600">
                          {formatCurrency(balancete.debito)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-green-600">
                          {formatCurrency(balancete.credito)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className={`text-sm font-medium ${balancete.saldo_atual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(balancete.saldo_atual)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Página {currentPage} de {totalPages}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}