import { useQuery } from '@tanstack/react-query';

const fetchDashboard = async () => {
  const res = await fetch('/api/summary');
  if (!res.ok) throw new Error('Failed to load dashboard');
  return res.json();
};

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    staleTime: 30_000,
    refetchOnWindowFocus: false
  });
}
