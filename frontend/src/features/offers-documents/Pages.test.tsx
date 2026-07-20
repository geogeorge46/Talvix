import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  offer: vi.fn(),
  candidate: vi.fn(),
  auth: vi.fn(),
}));
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => mocks.auth() }));
vi.mock('./api', () => ({
  useManagedOffer: () => mocks.offer(),
  useOfferHistory: () => ({ data: [] }),
  useOfferDocuments: () => ({ data: [], isLoading: false }),
  useOfferMutation: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCandidateOffer: () => mocks.candidate(),
  useCandidateTimeline: () => ({ data: [] }),
  useManagedOffers: () => ({ data: { items: [], page: 1, pages: 1 } }),
  useCandidateOffers: () => ({ data: [] }),
  useTemplates: () => ({ data: [] }),
  useTemplate: () => ({ isLoading: true }),
  useApprovals: () => ({ data: [] }),
  useApproval: () => ({ isLoading: true }),
  useDocuments: () => ({ data: { items: [], page: 1, pages: 1 } }),
  useVerificationQueue: () => ({ data: { items: [], page: 1, pages: 1 } }),
  useVerification: () => ({ isLoading: true }),
  useDocument: () => ({ isLoading: true }),
  useDocumentMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  safeDownload: vi.fn(),
  createUploadSession: vi.fn(),
  xhrUpload: vi.fn(),
}));
import { CandidateOfferDetailPage, ManagedOfferDetailPage } from './Pages';
const base = {
  id: '1'.repeat(24),
  title: 'Product designer',
  candidateName: 'Candidate',
  revisionNumber: 2,
  benefits: [],
  terms: [],
  clauses: [],
  compensation: { currency: 'INR', period: 'yearly', base: 100 },
};
describe('Phase 10 workflow pages', () => {
  beforeEach(() => {
    mocks.auth.mockReturnValue({
      recruiter: {
        permissions: [
          'offers.view',
          'offers.manage',
          'offers.send',
          'documents.view',
          'documents.manage',
        ],
      },
    });
  });
  it.each(['expired', 'withdrawn', 'superseded'] as const)(
    'makes %s candidate offers read-only',
    (status) => {
      mocks.candidate.mockReturnValue({
        data: { ...base, status },
        isLoading: false,
      });
      render(
        <MemoryRouter initialEntries={[`/candidate/offers/${'1'.repeat(24)}`]}>
          <Routes>
            <Route
              path="/candidate/offers/:offerId"
              element={<CandidateOfferDetailPage />}
            />
          </Routes>
        </MemoryRouter>,
      );
      expect(
        screen.getByText(new RegExp(`offer is ${status}`, 'i')),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /accept/i }),
      ).not.toBeInTheDocument();
    },
  );
  it('allows rejected drafts to be resubmitted and revised', () => {
    mocks.offer.mockReturnValue({
      data: { ...base, status: 'rejected' },
      isLoading: false,
    });
    render(
      <MemoryRouter initialEntries={[`/org/offers/${'1'.repeat(24)}`]}>
        <Routes>
          <Route
            path="/org/offers/:offerId"
            element={<ManagedOfferDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('button', { name: /submit for approval/i }),
    ).toBeEnabled();
    expect(
      screen.getByRole('link', { name: /create a revision/i }),
    ).toBeInTheDocument();
  });
  it('gates attachments independently from offer access', () => {
    mocks.auth.mockReturnValue({ recruiter: { permissions: ['offers.view'] } });
    mocks.offer.mockReturnValue({
      data: { ...base, status: 'draft' },
      isLoading: false,
    });
    render(
      <MemoryRouter initialEntries={[`/org/offers/${'1'.repeat(24)}`]}>
        <Routes>
          <Route
            path="/org/offers/:offerId"
            element={<ManagedOfferDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      screen.getByText(/documents.view permission is required/i),
    ).toBeInTheDocument();
  });
});
