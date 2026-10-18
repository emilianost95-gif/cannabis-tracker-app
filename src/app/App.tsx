import { Route, Routes } from 'react-router-dom';
import { Layout } from './Layout';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { RegisterPage } from '@/features/consumption/RegisterPage';
import { HistoryPage } from '@/features/consumption/HistoryPage';
import { EntryDetailPage } from '@/features/consumption/EntryDetailPage';
import { StatsPage } from '@/features/analytics/StatsPage';
import { ExpensesPage } from '@/features/expenses/ExpensesPage';
import { GoalsPage } from '@/features/goals/GoalsPage';
import { CheckinsPage } from '@/features/checkins/CheckinsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { NotFoundPage } from './NotFoundPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="registrar" element={<RegisterPage />} />
        <Route path="registrar/:id" element={<RegisterPage />} />
        <Route path="historial" element={<HistoryPage />} />
        <Route path="historial/:id" element={<EntryDetailPage />} />
        <Route path="estadisticas" element={<StatsPage />} />
        <Route path="gastos" element={<ExpensesPage />} />
        <Route path="objetivos" element={<GoalsPage />} />
        <Route path="diario" element={<CheckinsPage />} />
        <Route path="ajustes" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
