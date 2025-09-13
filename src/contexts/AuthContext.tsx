import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  username: string;
  nome: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        
        // Verificar se o token ainda é válido
        try {
          const decoded = JSON.parse(atob(storedToken));
          const { data: user, error } = await supabase
            .from('users')
            .select('id, username, nome')
            .eq('id', decoded.userId)
            .maybeSingle();

          if (error || !user) {
            throw new Error('Token inválido');
          }

          setUser(user);
        } catch {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
      }
      
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (username: string, password: string) => {
    console.log('Tentando login com:', username);
    
    try {
      // Buscar usuário no Supabase usando service role para bypass RLS
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      console.log('Resultado da busca:', { users, error });

      if (error) {
        console.error('Erro na consulta:', error);
        throw new Error('Erro ao buscar usuário');
      }

      if (!users) {
        console.log('Usuário não encontrado');
        throw new Error('Credenciais inválidas');
      }

      // Verificar senha
      console.log('Verificando senha...');
      console.log('Senha fornecida:', password);
      console.log('Senha no banco:', users.password);
      
      const isValidPassword = password === users.password;
      console.log('Senha válida:', isValidPassword);
      
      if (!isValidPassword) {
        throw new Error('Credenciais inválidas');
      }

      // Criar token simples
      const token = btoa(JSON.stringify({ userId: users.id, username: users.username }));
      const userData = {
        id: users.id,
        username: users.username,
        nome: users.nome
      };
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setToken(token);
      setUser(userData);
      
      console.log('Login realizado com sucesso');
      
    } catch (error) {
      console.error('Erro no login:', error);
      throw error;
    }
  };

  // Função alternativa usando RPC se a consulta direta falhar
  const loginWithRPC = async (username: string, password: string) => {
    try {
      const { data, error } = await supabase.rpc('authenticate_user', {
        p_username: username,
        p_password: password
      });

      if (error) throw error;
      if (!data) throw new Error('Credenciais inválidas');

      const userData = {
        id: data.id,
        username: data.username,
        nome: data.nome
      };

      const token = btoa(JSON.stringify({ userId: data.id, username: data.username }));
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setToken(token);
      setUser(userData);
      
    } catch (error) {
      console.error('Erro no login RPC:', error);
      throw new Error('Credenciais inválidas');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}