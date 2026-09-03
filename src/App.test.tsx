import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'

describe('App (scaffold placeholder)', () => {
  it('renders the Chinese scaffold placeholder', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: '素材评审工作台' })).toBeTruthy()
    expect(screen.getByText('脚手架就绪')).toBeTruthy()
  })
})
