import { useState, useCallback, useMemo } from 'react';

export const useKeysetPagination = ({
 pageSize = 20,
 initialSort = 'created_at',
 sortDirection = 'desc'
} = {}) => {
 const [cursors, setCursors] = useState(new Map());
 const [currentPage, setCurrentPage] = useState(1);
 const [hasNextPage, setHasNextPage] = useState(true);
 const [hasPrevPage, setHasPrevPage] = useState(false);
 const [loading, setLoading] = useState(false);
 const [total, setTotal] = useState(null);

 // Get cursor for pagination
 const getCursor = useCallback((data, field = initialSort) => {
 if (!data || !Array.isArray(data) || data.length === 0) return null;
 
 const lastItem = data[data.length - 1];
 return {
 value: lastItem[field],
 id: lastItem.id, // Use ID as tiebreaker for consistent ordering
 field,
 direction: sortDirection
 };
 }, [initialSort, sortDirection]);

 // Build cursor-based query conditions
 const buildCursorQuery = useCallback((cursor, direction = 'forward') => {
 if (!cursor) return {};

 const { value, id, field, direction: cursorDirection } = cursor;
 const isForward = direction === 'forward';
 const isAscending = cursorDirection === 'asc';
 
 // Determine comparison operator based on direction and sort order
 let operator;
 if (isForward) {
 operator = isAscending ? 'gt' : 'lt';
 } else {
 operator = isAscending ? 'lt' : 'gt';
 }

 return {
 cursor: {
 field,
 operator,
 value,
 id
 }
 };
 }, []);

 // Navigate to next page
 const nextPage = useCallback(() => {
 const cursor = cursors.get(currentPage);
 if (cursor && hasNextPage) {
 setCurrentPage(prev => prev + 1);
 }
 }, [cursors, currentPage, hasNextPage]);

 // Navigate to previous page 
 const prevPage = useCallback(() => {
 if (currentPage > 1) {
 setCurrentPage(prev => prev - 1);
 }
 }, [currentPage]);

 // Reset pagination
 const reset = useCallback(() => {
 setCursors(new Map());
 setCurrentPage(1);
 setHasNextPage(true);
 setHasPrevPage(false);
 setTotal(null);
 }, []);

 // Update pagination state after data fetch
 const updatePaginationState = useCallback((data, fetchedCount) => {
 // Update cursors for navigation
 if (data && data.length > 0) {
 const newCursor = getCursor(data);
 if (newCursor) {
 setCursors(prev => {
 const updated = new Map(prev);
 updated.set(currentPage, newCursor);
 return updated;
 });
 }
 }

 // Update navigation flags
 setHasNextPage(fetchedCount === pageSize);
 setHasPrevPage(currentPage > 1);
 
 // Estimate total if first page
 if (currentPage === 1 && data) {
 if (fetchedCount < pageSize) {
 setTotal(data.length);
 } else {
 setTotal(null); // Unknown total for cursor-based pagination
 }
 }
 }, [getCursor, currentPage, pageSize]);

 // Get current cursor for queries
 const getCurrentCursor = useCallback(() => {
 if (currentPage === 1) return null;
 return cursors.get(currentPage - 1) || null;
 }, [cursors, currentPage]);

 // Pagination info
 const paginationInfo = useMemo(() => ({
 currentPage,
 hasNextPage,
 hasPrevPage,
 pageSize,
 canGoNext: hasNextPage,
 canGoPrev: hasPrevPage,
 total: total || 'Unknown'
 }), [currentPage, hasNextPage, hasPrevPage, pageSize, total]);

 return {
 // State
 currentPage,
 hasNextPage,
 hasPrevPage,
 loading,
 total,
 paginationInfo,
 
 // Actions
 nextPage,
 prevPage,
 reset,
 setLoading,
 updatePaginationState,
 
 // Query helpers
 getCurrentCursor,
 buildCursorQuery,
 getCursor
 };
};