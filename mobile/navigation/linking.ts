/**
 * Expo deep linking configuration
 * Enables smartlab:// URI scheme + HTTPS universal links (iOS) / App Links (Android)
 *
 * Usage in _layout.tsx:
 *   import linking from '../navigation/linking';
 *   <NavigationContainer linking={linking} ...>
 *
 * QR code format: smartlab://check-in?bookingId=<id>
 * Web URL format: https://smartlab.example.com/check-in?bookingId=<id>
 */
import { LinkingOptions } from '@react-navigation/native';

const linking: LinkingOptions<any> = {
    prefixes: [
        'smartlab://',
        'https://smartlab.example.com',   // Update to your production domain
        'https://www.smartlab.example.com',
    ],
    config: {
        screens: {
            '(tabs)': {
                screens: {
                    index: { path: '' },
                    equipment: { path: 'equipment' },
                    bookings: { path: 'bookings' },
                    genai: { path: 'genai' },
                    approvals: { path: 'approvals' },
                },
            },
            'login': { path: 'login' },
            // Deep link: smartlab://check-in?bookingId=<id>
            // Maps to equipment/:id/book then navigates to check-in flow
            'check-in': {
                path: 'check-in',
                parse: { bookingId: (id: string) => id },
                stringify: { bookingId: (id: string) => id },
            },
            // Deep link: smartlab://equipment/:id/book
            'equipment/[id]/book': {
                path: 'equipment/:id/book',
                parse: { id: (id: string) => id },
                stringify: { id: (id: string) => id },
            },
        },
    },
};

export default linking;
