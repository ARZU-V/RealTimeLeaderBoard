import React, { useState } from 'react';
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
  const [searched, setSearched] = useState(false);

  const handleSearch = async (text) => {
    setQuery(text);
    
    if (text.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    try {
      setLoading(true);
      const response = await searchUsers(text);
      setResults(response.results || []);
      setSearched(true);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => (
    <LeaderboardItem
      rank={item.global_rank}
      username={item.username}
      rating={item.rating}
      isHighlighted={item.username.toLowerCase() === query.toLowerCase()}
    />
  );

  const renderEmptyState = () => {
    if (!searched) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>Search for Players</Text>
          <Text style={styles.emptySubtitle}>
            Enter a username to find their global rank
          </Text>
        </View>
      );
    }

    if (results.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>😔</Text>
          <Text style={styles.emptyTitle}>No Results Found</Text>
          <Text style={styles.emptySubtitle}>
            No players found matching "{query}"
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search username..."
          value={query}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => handleSearch('')}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item) => item.username}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={results.length === 0 ? styles.emptyList : null}
        />
      )}

      {results.length > 0 && (
        <View style={styles.resultsFooter}>
          <Text style={styles.resultsCount}>
            Found {results.length} player{results.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  clearButton: {
    marginLeft: 8,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 20,
    color: '#6B7280',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  resultsFooter: {
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
  },
  resultsCount: {
    fontSize: 14,
    color: '#6B7280',
  },
});

export default SearchScreen;