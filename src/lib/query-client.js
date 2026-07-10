import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			// Global 30s freshness floor. Focus-refetch is already off (above), so the remaining
			// redundant trigger was refetch-on-MOUNT: every navigation remounts a page's query
			// components and, with the previous default staleTime:0, refetched everything each time.
			// A 30s floor lets navigation reuse cache while keeping data fresh. This does NOT affect:
			// live polling (queries with refetchInterval keep polling) or post-action freshness
			// (mutations call invalidateQueries, which refetches regardless of staleTime). Pages that
			// set their own staleTime (60s/120s/5min across the app) still override this.
			staleTime: 30_000,
		},
	},
});