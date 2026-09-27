import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  notifications: vi.fn(),
  unreadCount: vi.fn(),
  mutateNotification: vi.fn(),
  preferences: vi.fn(),
  mutatePreferences: vi.fn(),
}));

vi.mock('./api', () => ({
  useNotifications: (...args: unknown[]) => mocks.notifications(...args),
  useUnreadCount: () => mocks.unreadCount(),
  useNotificationMutation: () => ({
    mutate: mocks.mutateNotification,
    isPending: false,
  }),
  useNotificationPreferences: () => mocks.preferences(),
  useNotificationPreferenceMutation: () => ({
    mutate: mocks.mutatePreferences,
    isPending: false,
  }),
}));

import { RecruiterNotificationsPage } from './RecruiterNotificationsPage';

describe('RecruiterNotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notifications.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        items: [
          {
            id: '64f1a2b3c4d5e6f7a8b9c0d1',
            title: 'New Offer Created',
            message: 'An offer has been created for candidate John Doe.',
            type: 'offer-created',
            category: 'offer',
            createdAt: '2026-09-25T10:00:00.000Z',
            read: false,
            archived: false,
            priority: 'high',
            actions: [
              { label: 'View Offer', type: 'link', path: '/org/offers/123' },
            ],
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      },
      refetch: vi.fn(),
    });
    mocks.unreadCount.mockReturnValue({ data: 1, refetch: vi.fn() });
    mocks.preferences.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        inAppEnabled: true,
        emailEnabled: true,
        digestEnabled: false,
        digestFrequency: 'daily',
        timezone: 'UTC',
        preferredHour: 9,
        quietHoursEnabled: false,
        quietStartHour: 22,
        quietEndHour: 7,
      },
    });
  });

  it('renders Notification Center inbox with metric cards, search input, and alert item', () => {
    render(
      <MemoryRouter initialEntries={['/notifications']}>
        <Routes>
          <Route path="/notifications" element={<RecruiterNotificationsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /notification center/i })).toBeInTheDocument();
    expect(screen.getByText('Total Alerts')).toBeInTheDocument();
    expect(screen.getByText('Unread Alerts')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search notifications/i)).toBeInTheDocument();
    expect(screen.getByText('New Offer Created')).toBeInTheDocument();
    expect(screen.getByText(/#NTF-B9C0D1/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view offer/i })).toBeInTheDocument();
  });

  it('allows filtering by read state and handles mark read action', () => {
    render(
      <MemoryRouter initialEntries={['/notifications']}>
        <Routes>
          <Route path="/notifications" element={<RecruiterNotificationsPage />} />
        </Routes>
      </MemoryRouter>
    );

    const markReadBtn = screen.getByRole('button', { name: /mark read/i });
    fireEvent.click(markReadBtn);

    expect(mocks.mutateNotification).toHaveBeenCalledWith({
      path: '/notifications/64f1a2b3c4d5e6f7a8b9c0d1/read',
    });
  });

  it('switches to Delivery Preferences tab and displays configuration cards', () => {
    render(
      <MemoryRouter initialEntries={['/notifications?tab=preferences']}>
        <Routes>
          <Route path="/notifications" element={<RecruiterNotificationsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /delivery channels/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /email digest schedule/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /quiet hours policy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save preferences/i })).toBeInTheDocument();
  });
});
