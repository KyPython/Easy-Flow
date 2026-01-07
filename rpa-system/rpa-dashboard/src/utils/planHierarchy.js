/**
 * Dynamic Plan Hierarchy Utility
 * Builds plan hierarchy dynamically from database instead of hardcoding
 * This ensures plans and prices can change without code updates
 */

import { initSupabase } from './supabaseClient';

// Cache for plan hierarchy (refreshes on plan changes)
let cachedHierarchy = null;
let lastFetch = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch all plans and build hierarchy based on created_at order
 * Lower index = lower tier plan
 */
export async function getPlanHierarchy() {
 const now = Date.now();
 
 // Return cached hierarchy if still valid
 if (cachedHierarchy && (now - lastFetch) < CACHE_TTL) {
 return cachedHierarchy;
 }

 try {
 const client = await initSupabase();
 const { data: plans, error } = await client
 .from('plans')
 .select('id, name, slug, created_at')
 .order('created_at', { ascending: true });

 if (error) throw error;

 // Build hierarchy: index = tier level (0 = lowest, higher = premium)
 const hierarchy = {};
 if (plans && plans.length > 0) {
 plans.forEach((plan, index) => {
 const key = (plan.slug || plan.name || '').toLowerCase();
 if (key) {
 hierarchy[key] = index;
 // Also map by name for flexibility
 hierarchy[plan.name?.toLowerCase()] = index;
 }
 });
 }

 // Fallback hierarchy if no plans found (for development)
 if (Object.keys(hierarchy).length === 0) {
 hierarchy['hobbyist'] = 0;
 hierarchy['free'] = 0;
 hierarchy['starter'] = 1;
 hierarchy['professional'] = 2;
 hierarchy['enterprise'] = 3;
 }

 cachedHierarchy = hierarchy;
 lastFetch = now;
 return hierarchy;
 } catch (error) {
 console.error('[PlanHierarchy] Error fetching plans, using fallback:', error);
 
 // Fallback hierarchy on error
 const fallback = {
 'hobbyist': 0,
 'free': 0,
 'starter': 1,
 'professional': 2,
 'enterprise': 3
 };
 
 cachedHierarchy = fallback;
 lastFetch = now;
 return fallback;
 }
}

/**
 * Get plan level for a given plan name/slug
 * Returns the tier level (0 = lowest, higher = premium)
 */
export async function getPlanLevel(planName) {
 if (!planName) return 0;
 
 const hierarchy = await getPlanHierarchy();
 const normalized = planName.toLowerCase().trim();
 return hierarchy[normalized] ?? 0;
}

/**
 * Compare two plans - returns true if plan1 >= plan2 in hierarchy
 */
export async function comparePlans(plan1Name, plan2Name) {
 const level1 = await getPlanLevel(plan1Name);
 const level2 = await getPlanLevel(plan2Name);
 return level1 >= level2;
}

/**
 * Clear cache (useful when plans are updated)
 */
export function clearPlanHierarchyCache() {
 cachedHierarchy = null;
 lastFetch = 0;
}

