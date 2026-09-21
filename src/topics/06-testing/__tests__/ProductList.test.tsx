import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react'
import { ProductList } from '../_lib/components'
import type { Product } from '../_lib/components'

/* ===========================================================================
   ASYNC TESTING AND MOCKING THE NETWORK

   Three things this file demonstrates:
     1. findBy*  — the query that waits. Use it instead of waitFor + getBy.
     2. Mocking `fetch` with vi.fn — fine for a couple of tests. For a real
        app, MSW intercepts at the network layer, so your component's fetch
        code is genuinely exercised rather than stubbed.
     3. Testing the loading, success, empty AND error states. The error state
        is the one people skip, and it is the one that breaks in production.
   =========================================================================== */

const PRODUCTS: Product[] = [
  { id: 1, title: 'Mechanical keyboard', price: 89 },
  { id: 2, title: '27-inch monitor', price: 340 },
]

function mockFetchOnce(body: unknown, { ok = true, status = 200 } = {}) {
  const mock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  } as Response)
  vi.stubGlobal('fetch', mock)
  return mock
}

afterEach(() => {
  // Undo vi.stubGlobal so one test cannot leak its mock into the next.
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ProductList', () => {
  it('shows a loading state, then the products', async () => {
    mockFetchOnce(PRODUCTS)

    render(<ProductList category="peripherals" />)

    // The loading state is synchronous — it is in the first render — so
    // getBy* is correct here, not findBy*.
    expect(screen.getByText(/loading products/i)).toBeInTheDocument()

    // findBy* = getBy* + waitFor. It retries until the element appears or the
    // timeout expires, and produces a much better failure message than a bare
    // waitFor wrapping an assertion.
    expect(await screen.findByText(/mechanical keyboard/i)).toBeInTheDocument()
    expect(screen.getByText(/27-inch monitor/i)).toBeInTheDocument()

    // And the loading state is gone.
    expect(screen.queryByText(/loading products/i)).not.toBeInTheDocument()
  })

  it('calls the API with the right query string', async () => {
    const fetchMock = mockFetchOnce(PRODUCTS)

    render(<ProductList category="audio" />)
    await screen.findByRole('list')

    expect(fetchMock).toHaveBeenCalledWith('/api/products?category=audio')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('renders an empty state', async () => {
    mockFetchOnce([])

    render(<ProductList category="cables" />)

    expect(await screen.findByText(/no products in cables/i)).toBeInTheDocument()
  })

  it('renders an error state when the request fails', async () => {
    // THE TEST PEOPLE SKIP. Error paths are the least-exercised code in most
    // applications and the most likely to be broken.
    mockFetchOnce(null, { ok: false, status: 500 })

    render(<ProductList category="peripherals" />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/failed with 500/i)
  })

  it('waitForElementToBeRemoved, for when the absence is the point', async () => {
    mockFetchOnce(PRODUCTS)
    render(<ProductList category="peripherals" />)

    // Slightly clearer intent than asserting the list appeared, when what you
    // actually care about is that the spinner went away.
    await waitForElementToBeRemoved(() => screen.queryByText(/loading products/i))

    expect(screen.getByRole('list', { name: /peripherals products/i })).toBeInTheDocument()
  })

  it('waitFor is for assertions that are not about an element appearing', async () => {
    const fetchMock = mockFetchOnce(PRODUCTS)
    render(<ProductList category="peripherals" />)

    // findBy* only works for elements. When the thing you are waiting on is a
    // mock call, a value, or anything else, waitFor is the right tool.
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
  })
})
