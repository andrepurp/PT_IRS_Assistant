import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the IRS assistant header', () => {
  render(<App />);
  const heading = screen.getByText(/Assistente de IRS/i);
  expect(heading).toBeInTheDocument();
});

test('shows the three main tabs', () => {
  render(<App />);
  expect(screen.getByRole('button', { name: /Mais-Valias/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /e-Fatura/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Instruções/i })).toBeInTheDocument();
});
