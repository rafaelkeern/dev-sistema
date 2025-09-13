import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, TrendingUp, Filter, BarChart3, FileText, Activity, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/LoadingSpinner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

interface Cliente {
  id: number;
  nome: string;
  cnpj: string;
  _count: {
    balancetes: number;
    dfc: number;
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

interface DFC {
  id: number;
  titulo: string;
  descricao: string;
  valor: number;
  periodo_inicio: string;
  periodo_fim: string;
  ordem?: number;
}

export default function ClienteDetalhes() {
  const { id } = useParams<{ id: string }>();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [activeTab, setActiveTab] = useState<'balancete' | 'dfc'>('balancete');
  const [balancetes, setBalancetes] = useState<Balancete[]>([]);
  const [dfcData, setDfcData] = useState<DFC[]>([]);
  const [resumos, setResumos] = useState<ResumoPerido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deletingPeriod, setDeletingPeriod] = useState<string | null>(null);
  const [filtros, setFiltros] = useState({
    dataInicio: '',
    dataFim: ''
  });

  useEffect(() => {
    if (id) {
      fetchClienteDetalhes();
      fetchBalancetes();
      fetchDFC();
      fetchResumos();
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchBalancetes();
      fetchDFC();
    }
  }, [currentPage, filtros]);

 const fetchClienteDetalhes = async () => {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select(`
        *,
        balancetes (id, periodo_inicio, periodo_fim, updated_at),
        dfc (id, periodo_inicio, periodo_fim, updated_at)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new Error('Cliente não encontrado');
    }

    // Agrupar balancetes por período único
    const uniqueBalancetePeriods = new Set<string>();
    (data.balancetes || []).forEach((b: any) => {
      uniqueBalancetePeriods.add(`${b.periodo_inicio}_${b.periodo_fim}`);
    });

    // Agrupar dfc por período único
    const uniqueDfcPeriods = new Set<string>();
    (data.dfc || []).forEach((d: any) => {
      uniqueDfcPeriods.add(`${d.periodo_inicio}_${d.periodo_fim}`);
    });

    // Contar as importações mais recentes (baseado no max updated_at)
    const allUpdatedAt = [
      ...(data.balancetes || []).map((b: any) => b.updated_at),
      ...(data.dfc || []).map((d: any) => d.updated_at)
    ].filter(Boolean);

    const ultimaImportacao = allUpdatedAt.length > 0
      ? new Date(Math.max(...allUpdatedAt.map(d => new Date(d).getTime()))).toISOString()
      : null;

    setCliente({
      ...data,
      _count: {
        balancetes: uniqueBalancetePeriods.size,
        dfc: uniqueDfcPeriods.size
      },
      ultimaImportacao
    });

  } catch (err) {
    setError(err instanceof Error ? err.message : 'Erro ao carregar cliente');
  }
};


  const fetchDFC = async () => {
    try {
      let query = supabase
        .from('dfc')
        .select('*')
        .eq('cliente_id', id)
        .order('periodo_inicio', { ascending: true });

      // Aplicar filtros de data
      if (filtros.dataInicio) {
        query = query.gte('periodo_inicio', filtros.dataInicio);
      }
      if (filtros.dataFim) {
        query = query.lte('periodo_fim', filtros.dataFim);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error('Erro ao carregar dados DFC');
      }

      setDfcData(data || []);
    } catch (err) {
      console.error('Erro ao carregar DFC:', err);
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

  const handleDeletePeriod = async (periodoInicio: string, periodoFim: string) => {
    const periodoKey = `${periodoInicio}-${periodoFim}`;
    
    if (!confirm(`Tem certeza que deseja excluir todos os balancetes do período ${formatDate(periodoInicio)} - ${formatDate(periodoFim)}?`)) {
      return;
    }

    setDeletingPeriod(periodoKey);
    
    try {
      const { error } = await supabase
        .from('balancetes')
        .delete()
        .eq('cliente_id', id)
        .eq('periodo_inicio', periodoInicio)
        .eq('periodo_fim', periodoFim);

      if (error) {
        throw new Error('Erro ao excluir balancetes: ' + error.message);
      }

      // Recarregar dados
      await fetchClienteDetalhes();
      await fetchBalancetes();
      await fetchResumos();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir período');
    } finally {
      setDeletingPeriod(null);
    }
  };

  const handleDeleteDFCPeriod = async (periodoInicio: string, periodoFim: string) => {
    const periodoKey = `${periodoInicio}-${periodoFim}`;
    
    if (!confirm(`Tem certeza que deseja excluir todos os dados DFC do período ${formatDate(periodoInicio)} - ${formatDate(periodoFim)}?`)) {
      return;
    }

    setDeletingPeriod(periodoKey);
    
    try {
      const { error } = await supabase
        .from('dfc')
        .delete()
        .eq('cliente_id', id)
        .eq('periodo_inicio', periodoInicio)
        .eq('periodo_fim', periodoFim);

      if (error) {
        throw new Error('Erro ao excluir dados DFC: ' + error.message);
      }

      // Recarregar dados
      await fetchClienteDetalhes();
      await fetchDFC();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir período DFC');
    } finally {
      setDeletingPeriod(null);
    }
  };
  // Agrupar balancetes por período para mostrar resumo
  const balancetesPorPeriodo = balancetes.reduce((acc, balancete) => {
    const periodoKey = `${balancete.periodo_inicio}-${balancete.periodo_fim}`;
    if (!acc[periodoKey]) {
      acc[periodoKey] = {
        periodo_inicio: balancete.periodo_inicio,
        periodo_fim: balancete.periodo_fim,
        count: 0,
        total_debito: 0,
        total_credito: 0,
        total_saldo_atual: 0
      };
    }
    acc[periodoKey].count++;
    acc[periodoKey].total_debito += balancete.debito;
    acc[periodoKey].total_credito += balancete.credito;
    acc[periodoKey].total_saldo_atual += balancete.saldo_atual;
    return acc;
  }, {} as Record<string, {
    periodo_inicio: string;
    periodo_fim: string;
    count: number;
    total_debito: number;
    total_credito: number;
    total_saldo_atual: number;
  }>);

  const periodosResumo = Object.values(balancetesPorPeriodo).sort((a, b) => 
    new Date(b.periodo_inicio).getTime() - new Date(a.periodo_inicio).getTime()
  );

  // Agrupar DFC por período para mostrar resumo
  const dfcPorPeriodo = dfcData.reduce((acc, dfc) => {
    const periodoKey = `${dfc.periodo_inicio}-${dfc.periodo_fim}`;
    if (!acc[periodoKey]) {
      acc[periodoKey] = {
        periodo_inicio: dfc.periodo_inicio,
        periodo_fim: dfc.periodo_fim,
        count: 0,
        total_valor: 0
      };
    }
    acc[periodoKey].count++;
    acc[periodoKey].total_valor += dfc.valor;
    return acc;
  }, {} as Record<string, {
    periodo_inicio: string;
    periodo_fim: string;
    count: number;
    total_valor: number;
  }>);

  const periodosDFCResumo = Object.values(dfcPorPeriodo).sort((a, b) => 
    new Date(b.periodo_inicio).getTime() - new Date(a.periodo_inicio).getTime()
  );
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
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            {cliente._count.dfc} DFC
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            {cliente._count.balancetes} balancetes
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('balancete')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'balancete'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileText className="h-4 w-4 inline mr-2" />
              Balancetes
            </button>
            <button
              onClick={() => setActiveTab('dfc')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'dfc'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Activity className="h-4 w-4 inline mr-2" />
              DFC
            </button>
          </nav>
        </div>

      {/* Charts */}
      {activeTab === 'balancete' && chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Débitos e Créditos */}
          <div className="p-6">
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
          <div className="p-6">
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

      {/* DFC Charts */}
      {activeTab === 'dfc' && dfcData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fluxo por Categoria */}
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Fluxo por Categoria
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={
                Object.entries(
                  dfcData.reduce((acc, item) => {
                    acc[item.titulo] = (acc[item.titulo] || 0) + item.valor;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([titulo, valor]) => ({ titulo, valor }))
              }>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="titulo" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar dataKey="valor" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Distribuição de Valores */}
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Distribuição por Categoria
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={Object.entries(
                    dfcData.reduce((acc, item) => {
                      acc[item.titulo] = (acc[item.titulo] || 0) + Math.abs(item.valor);
                      return acc;
                    }, {} as Record<string, number>)
                  ).map(([titulo, valor]) => ({ titulo, valor }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ titulo, percent }) => `${titulo}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="valor"
                >
                  {Object.keys(dfcData.reduce((acc, item) => {
                    acc[item.titulo] = true;
                    return acc;
                  }, {} as Record<string, boolean>)).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'][index % 5]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="p-6 border-t">
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

      {/* Tabelas */}
      {activeTab === 'balancete' && (
        <>
          {/* Resumo por Período */}
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Resumo por Período</h3>
          </div>
          {periodosResumo.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum período encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Período
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registros
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {periodosResumo.map((periodo) => {
                    const periodoKey = `${periodo.periodo_inicio}-${periodo.periodo_fim}`;
                    const isDeleting = deletingPeriod === periodoKey;
                    
                    return (
                      <tr key={periodoKey} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatDate(periodo.periodo_inicio)} - {formatDate(periodo.periodo_fim)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {periodo.count}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleDeletePeriod(periodo.periodo_inicio, periodo.periodo_fim)}
                            disabled={isDeleting}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Excluir período"
                          >
                            {isDeleting ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Dados Detalhados - Balancetes</h3>
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
                        Classificação
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
                            {balancete.classificacao}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {balancete.descricao_conta}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {balancete.classificacao}
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
        </>
      )}

      {/* Tabela DFC */}
      {activeTab === 'dfc' && (
        <>
          {/* Resumo por Período DFC */}
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Registros por Período</h3>
          </div>
          {periodosDFCResumo.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum período DFC encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Período
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registros
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {periodosDFCResumo.map((periodo) => {
                    const periodoKey = `${periodo.periodo_inicio}-${periodo.periodo_fim}`;
                    const isDeleting = deletingPeriod === periodoKey;
                    
                    return (
                      <tr key={periodoKey} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatDate(periodo.periodo_inicio)} - {formatDate(periodo.periodo_fim)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {periodo.count}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleDeleteDFCPeriod(periodo.periodo_inicio, periodo.periodo_fim)}
                            disabled={isDeleting}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Excluir período DFC"
                          >
                            {isDeleting ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Dados Detalhados - DFC</h3>
          </div>

          {dfcData.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum dado DFC encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Título
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Descrição
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Período
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {[...dfcData]
  .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
  .map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {item.titulo}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {item.descricao}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(item.periodo_inicio)} - {formatDate(item.periodo_fim)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className={`text-sm font-medium ${item.valor >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(item.valor)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      </div>

    </div>
  );
}