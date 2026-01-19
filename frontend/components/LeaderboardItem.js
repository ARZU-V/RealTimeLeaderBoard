import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const LeaderboardItem = ({ rank, username, rating, isHighlighted, movement }) => {
  
  // Rank Colors
  const getRankColor = (rank) => {
    if (rank === 1) return '#FFD700'; // Gold
    if (rank === 2) return '#C0C0C0'; // Silver
    if (rank === 3) return '#CD7F32'; // Bronze
    return '#6B7280';
  };

  // Rank Medals
  const getRankEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  };

  // Movement Arrows (Up/Down)
  const renderMovement = (move) => {
    if (move > 0) return <Text style={styles.moveUp}>▲ {move}</Text>;
    if (move < 0) return <Text style={styles.moveDown}>▼ {Math.abs(move)}</Text>;
    return <Text style={styles.moveSame}>-</Text>;
  };

  return (
    <View style={[styles.container, isHighlighted && styles.highlighted]}>
      {/* Rank Section */}
      <View style={styles.rankContainer}>
        <Text style={styles.rankEmoji}>{getRankEmoji(rank)}</Text>
        <Text style={[styles.rank, { color: getRankColor(rank) }]}>
          #{rank}
        </Text>
      </View>
      
      {/* Username */}
      <Text style={styles.username} numberOfLines={1}>
        {username}
      </Text>
      
      {/* Score & Movement */}
      <View style={styles.rightSection}>
        <View style={styles.moveContainer}>
          {renderMovement(movement)}
        </View>
        <View style={styles.ratingContainer}>
          <Text style={styles.rating}>{rating}</Text>
          <Text style={styles.ratingLabel}>pts</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  highlighted: {
    backgroundColor: '#FEF3C7',
  },
  rankContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 70,
  },
  rankEmoji: {
    fontSize: 20,
    marginRight: 4,
  },
  rank: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  username: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    marginLeft: 8,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moveContainer: {
    width: 45,
    alignItems: 'flex-end',
    marginRight: 10,
  },
  moveUp: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  moveDown: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  moveSame: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '700',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    width: 60,
    justifyContent: 'flex-end',
  },
  rating: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  ratingLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginLeft: 2,
  },
});

export default LeaderboardItem;