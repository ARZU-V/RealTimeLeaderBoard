import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  FlatList,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';

import { searchUsers } from '../services/api';
import LeaderboardItem from '../components/LeaderboardItem';

const SearchScreen = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Refs for Debouncing and State Management
  const queryRef = useRef('');
  const typingTimeoutRef = useRef(null);

  //  SEARCH API CALL 
  const fetchSearchResults = async (text, pageNum, shouldAppend = false) => {
  
    if (text.length < 1) return;
    
    try {
     
      if (!shouldAppend) setLoading(true);

      console.log(`Searching for "${text}" - Page ${pageNum}`);

      // USE THE API FUNCTION
      const response = await searchUsers(text, pageNum);
      const newResults = response.results || [];

      if (shouldAppend) {
        // APPEND new users to the existing list (Infinite Scroll)
        setResults(prev => [...prev, ...newResults]);
      } else {
        // REPLACE list (New Search)
        setResults(newResults);
      }

      // If we received fewer than 50 items, we have reached the end of the list
      setHasMore(newResults.length === 50);

    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  //  (Debouncing)
  const handleTextChange = (text) => {
    setQuery(text);
    queryRef.current = text;
    setPage(1); 
    setHasMore(true);

    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (text.length < 1) {
      setResults([]);
      return;
    }

    // Wait 300ms before calling API
    typingTimeoutRef.current = setTimeout(() => {
      fetchSearchResults(text, 1, false);
    }, 300);
  };

  // Infinite Scroll Handler
  const handleLoadMore = () => {
    // Don't load if already loading or no more data
    if (!hasMore || loading) return;
    
    const nextPage = page + 1;
    setPage(nextPage);
    
    // Call API for Next Page and Append Data
    fetchSearchResults(queryRef.current, nextPage, true);
  };

  const renderItem = ({ item }) => (
    <LeaderboardItem
      rank={item.global_rank}
      username={item.username}
      rating={item.rating}
      isHighlighted={item.username.toLowerCase() === query.toLowerCase()}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search Like Mathy.. Or GeoGuru"
          value={query}
          onChangeText={handleTextChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => handleTextChange('')}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Show Full Screen Loader ONLY for first page */}
      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderItem}
          // Use index to ensure uniqueness if ranks shift during scroll
          keyExtractor={(item, index) => item.username + index} 
          
          // --- INFINITE SCROLL TRIGGERS ---
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5} // Load more when halfway down the current list
          
          // Show small spinner at the bottom when loading more
          ListFooterComponent={ 
            hasMore && results.length > 0 ? (
              <ActivityIndicator color="#3B82F6" style={{margin: 20}}/> 
            ) : null 
          }
          
          ListEmptyComponent={
            !loading && query.length > 0 && results.length === 0 ? (
               <Text style={styles.emptyText}>No users found.</Text>
            ) : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  searchContainer: { 
    flexDirection: 'row', 
    padding: 16, 
    backgroundColor: '#fff', 
    paddingTop: 60, 
    borderBottomWidth: 1, 
    borderColor: '#E5E7EB' 
  },
  searchInput: { 
    flex: 1, 
    height: 48, 
    backgroundColor: '#F3F4F6', 
    borderRadius: 12, 
    paddingHorizontal: 16, 
    fontSize: 16 
  },
  clearButton: { 
    marginLeft: 8, 
    justifyContent: 'center', 
    width: 32   
  },
  clearButtonText: { fontSize: 20, color: '#6B7280' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#6B7280', fontSize: 16 }
});

export default SearchScreen;