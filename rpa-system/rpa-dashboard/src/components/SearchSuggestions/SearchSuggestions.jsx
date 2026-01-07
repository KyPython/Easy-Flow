import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import styles from './SearchSuggestions.module.css';

const SearchSuggestions = ({ query, onSelect, placeholder = "Search the web..." }) => {
 const [suggestions, setSuggestions] = useState([]);
 const [loading, setLoading] = useState(false);
 const [showDropdown, setShowDropdown] = useState(false);
 const debounceTimer = useRef(null);
 const dropdownRef = useRef(null);

 // ✅ OBSERVABILITY: Log search queries
 const searchWeb = useCallback(async (searchQuery) => {
 if (!searchQuery || searchQuery.length < 3) {
 setSuggestions([]);
 return;
 }

 console.log('[SearchSuggestions] Searching web', { query: searchQuery });
 setLoading(true);

 try {
 // Use DuckDuckGo Instant Answer API (no API key required)
 const response = await fetch(
 `https://api.duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&format=json&no_html=1&skip_disambig=1`
 );
 
 const data = await response.json();
 console.log('[SearchSuggestions] Search results', { 
 query: searchQuery, 
 resultsCount: data.RelatedTopics?.length || 0 
 });

 // Parse DuckDuckGo results
 const results = [];
 
 // Add main result if available
 if (data.AbstractURL) {
 results.push({
 title: data.Heading || searchQuery,
 url: data.AbstractURL,
 description: data.AbstractText || 'Main result',
 type: 'main'
 });
 }

 // Add related topics
 if (data.RelatedTopics) {
 data.RelatedTopics.forEach(topic => {
 if (topic.FirstURL && topic.Text) {
 results.push({
 title: topic.Text.split(' - ')[0] || topic.Text,
 url: topic.FirstURL,
 description: topic.Text,
 type: 'related'
 });
 }
 });
 }

 // If no results from DuckDuckGo, create search engine links
 if (results.length === 0) {
 results.push({
 title: `Search "${searchQuery}" on Google`,
 url: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
 description: 'Open Google search in new tab',
 type: 'search-engine'
 });
 }

 setSuggestions(results.slice(0, 8)); // Limit to 8 results
 setShowDropdown(true);
 
 } catch (error) {
 console.error('[SearchSuggestions] Search failed', error);
 // Fallback: provide search engine links
 setSuggestions([
 {
 title: `Search "${searchQuery}" on Google`,
 url: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
 description: 'Open Google search',
 type: 'search-engine'
 },
 {
 title: `Search "${searchQuery}" on Bing`,
 url: `https://www.bing.com/search?q=${encodeURIComponent(searchQuery)}`,
 description: 'Open Bing search',
 type: 'search-engine'
 }
 ]);
 setShowDropdown(true);
 } finally {
 setLoading(false);
 }
 }, []);

 // Debounced search
 useEffect(() => {
 if (debounceTimer.current) {
 clearTimeout(debounceTimer.current);
 }

 if (query && query.length >= 3) {
 debounceTimer.current = setTimeout(() => {
 searchWeb(query);
 }, 500);
 } else {
 setSuggestions([]);
 setShowDropdown(false);
 }

 return () => {
 if (debounceTimer.current) {
 clearTimeout(debounceTimer.current);
 }
 };
 }, [query, searchWeb]);

 // Click outside to close
 useEffect(() => {
 const handleClickOutside = (event) => {
 if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
 setShowDropdown(false);
 }
 };

 document.addEventListener('mousedown', handleClickOutside);
 return () => document.removeEventListener('mousedown', handleClickOutside);
 }, []);

 const handleSelect = (suggestion) => {
 console.log('[SearchSuggestions] Selected', { url: suggestion.url });
 onSelect(suggestion.url);
 setShowDropdown(false);
 };

 if (!showDropdown || suggestions.length === 0) {
 return null;
 }

 return (
 <div className={styles.dropdown} ref={dropdownRef}>
 {loading && (
 <div className={styles.loading}>
 <span className={styles.spinner}></span>
 Searching...
 </div>
 )}
 
 {!loading && suggestions.length > 0 && (
 <div className={styles.results}>
 <div className={styles.resultsHeader}>
 🌐 Web Results for "{query}"
 </div>
 {suggestions.map((suggestion, index) => (
 <button
 key={index}
 className={styles.suggestion}
 onClick={() => handleSelect(suggestion)}
 type="button"
 >
 <div className={styles.suggestionContent}>
 <div className={styles.suggestionTitle}>
 {suggestion.type === 'main' && '⭐ '}
 {suggestion.type === 'search-engine' && '🔍 '}
 {suggestion.title}
 </div>
 {suggestion.description && (
 <div className={styles.suggestionDescription}>
 {suggestion.description.substring(0, 100)}
 {suggestion.description.length > 100 ? '...' : ''}
 </div>
 )}
 <div className={styles.suggestionUrl}>
 {new URL(suggestion.url).hostname}
 </div>
 </div>
 </button>
 ))}
 </div>
 )}
 </div>
 );
};

SearchSuggestions.propTypes = {
 query: PropTypes.string.isRequired,
 onSelect: PropTypes.func.isRequired,
 placeholder: PropTypes.string
};

export default SearchSuggestions;
