import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, FileText, TrendingUp, Calendar, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/LoadingSpinner';

interface Cliente {
  id: number;
  nome: string;
  cnpj: string;
  balancetes: { updated_at: string }[];
  _count: {
    balancetes: number;
  };
  ultimaImportacao: string | null;
}

interface Stats {
  totalClientes: number;
  totalBalancetes: number;
  clientesComDados: number;
  ultimaImportacao: string | null;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
  try {
    // Buscar clientes com updated_at dos balancetes relacionados
    const { data: clientesData, error: clientesError } = await supabase
      .from('clientes')
      .select(`
        id,
        nome,
        cnpj,
        balancetes (
          updated_at
        )
      `)
      .order('nome');

    if (clientesError) {
      throw new Error('Erro ao carregar clientes');
    }

    // Processar dados dos clientes
    const processedClientes: Cliente[] = (clientesData || []).map((cliente: any) => {
      // Agrupar balancetes por períodos distintos (datas de início e fim)
      const uniquePeriods = new Set<string>(); // Usamos Set para garantir que os períodos sejam únicos

      cliente.balancetes?.forEach((balancete: any) => {
        const periodo = `${balancete.updated_at}`; // Aqui você pode definir a regra para identificar o período único
        uniquePeriods.add(periodo);
      });

      // O número de períodos distintos é o tamanho do Set
      const balancetesCount = uniquePeriods.size;

      // Usar updated_at mais recente para última importação
      const ultimaImportacao = cliente.balancetes && cliente.balancetes.length
        ? cliente.balancetes.reduce((latest: string, balancete: any) => {
            if (!latest) return balancete.updated_at;
            return new Date(balancete.updated_at) > new Date(latest)
              ? balancete.updated_at
              : latest;
          }, '')
        : null;

      return {
        ...cliente,
        _count: {
          balancetes: balancetesCount // Agora conta os períodos distintos
        },
        ultimaImportacao,
      };
    });

    setClientes(processedClientes);

    // Calcular estatísticas
    const totalClientes = processedClientes.length;

    // Calcular o total de balancetes
    const uniquePeriodsGlobal = new Set<string>(); // Para contar todos os períodos distintos
    processedClientes.forEach(cliente => {
      cliente.balancetes?.forEach((balancete: any) => {
        const periodo = `${balancete.updated_at}`;
        uniquePeriodsGlobal.add(periodo);
      });
    });

    const totalBalancetes = uniquePeriodsGlobal.size; // Total de períodos distintos

    const clientesComDados = processedClientes.filter(
      (cliente) => cliente._count.balancetes > 0
    ).length;

    // Última importação global (data mais recente entre todos os clientes)
    const ultimaImportacaoGlobal = processedClientes.reduce((latest: string | null, cliente: any) => {
      if (cliente.ultimaImportacao && (!latest || new Date(cliente.ultimaImportacao) > new Date(latest))) {
        return cliente.ultimaImportacao;
      }
      return latest;
    }, null);

    setStats({
      totalClientes,
      totalBalancetes, // Atualiza com o total de períodos distintos
      clientesComDados,
      ultimaImportacao: ultimaImportacaoGlobal
        ? new Date(ultimaImportacaoGlobal).toLocaleDateString('pt-BR')
        : 'Nenhuma',
    });

  } catch (err) {
    setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
  } finally {
    setLoading(false);
  }
};

  if (loading) {
    return <LoadingSpinner text="Carregando dashboard..." />;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Visão geral do sistema</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total de Clientes</p>
              <p className="text-2xl font-semibold text-gray-900">{stats?.totalClientes ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <FileText className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total de Balancetes</p>
              <p className="text-2xl font-semibold text-gray-900">{stats?.totalBalancetes ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Clientes com Dados</p>
              <p className="text-2xl font-semibold text-gray-900">{stats?.clientesComDados ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Calendar className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Última Importação</p>
              <p className="text-sm font-semibold text-gray-900">
                {stats?.ultimaImportacao || 'Nenhuma'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Clients */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Clientes Recentes</h2>
            <Link
              to="/clientes"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Ver todos
            </Link>
          </div>
        </div>
        <div className="p-6">
          {clientes.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum cliente cadastrado</p>
              <Link
                to="/clientes"
                className="mt-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Cadastrar Cliente
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {clientes.slice(0, 5).map((cliente) => (
                <div
                  key={cliente.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <h3 className="font-medium text-gray-900">{cliente.nome}</h3>
                    <p className="text-sm text-gray-600">CNPJ: {cliente.cnpj}</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {cliente._count?.balancetes ?? 0} balancetes
                      </p>
                      <p className="text-xs text-gray-500">registrados</p>
                      {cliente.ultimaImportacao && (
                        <p className="text-xs text-gray-500">
                          Última: {new Date(cliente.ultimaImportacao).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                    <Link
                      to={`/clientes/${cliente.id}`}
                      className="inline-flex items-center p-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
