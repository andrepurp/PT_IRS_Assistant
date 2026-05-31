import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

test('renders the IRS assistant header', () => {
  render(<App />);
  expect(screen.getByText(/Assistente de IRS/i)).toBeInTheDocument();
});

test('shows all main tabs', () => {
  render(<App />);
  ['Mais-Valias', 'Salário Líquido', 'Dividendos', 'Imóveis', 'Simulador IRS', 'e-Fatura', 'Instruções'].forEach((t) => {
    expect(screen.getByRole('button', { name: new RegExp(t, 'i') })).toBeInTheDocument();
  });
});

// Cada separador deve montar sem erros e mostrar o seu conteúdo.
test.each([
  ['Salário Líquido', /Vencimento bruto mensal/i],
  ['Dividendos', /Dividendos Estrangeiros/i],
  ['Imóveis', /Mais-Valias Imobiliárias/i],
  ['Simulador IRS', /Simulador de IRS/i],
  ['e-Fatura', /Estimativa indicativa/i],
  ['Instruções', /Como funciona/i],
])('tab "%s" renders its content', (tab, contentRegex) => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(tab, 'i') }));
  expect(screen.getAllByText(contentRegex).length).toBeGreaterThan(0);
});

test('Salário Líquido computes a net result when a gross value is entered', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /Salário Líquido/i }));
  fireEvent.change(screen.getByPlaceholderText('1500'), { target: { value: '1500' } });
  expect(screen.getByText(/165\.00€/)).toBeInTheDocument(); // Segurança Social 11% de 1500
  expect(screen.getByText(/1166\.83€/)).toBeInTheDocument(); // líquido
});
