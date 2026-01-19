import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Animated,
  ScrollView,
  Image,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLeaderboard, toggleSimulation, getSimulationStatus } from '../services/api';
import LeaderboardItem from '../components/LeaderboardItem';

// SETTINGS
const PAGE_SIZE = 100; 
const PREFETCH_THRESHOLD = 2; // Loads more data before you hit the bottom

const LeaderboardScreen = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true); // True initially for "Cold Start"
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Simulation & Modal State
  const [simActive, setSimActive] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // Refs
  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => { pageRef.current = page; }, [page]);

  // --- 1. STARTUP & AUTO-REFRESH ---
  useEffect(() => {
    checkSimStatus();
    loadLeaderboard();

    // Background silent update every 2 seconds
    const intervalId = setInterval(() => {
      loadLeaderboardSilent();
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  // --- 2. BLINKING ANIMATION FOR INFO BUTTON ---
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // --- 3. HELPERS ---
  const processDataWithMovement = (newData, oldData) => {
    const oldRankMap = new Map();
    oldData.forEach((item) => oldRankMap.set(item.username, item.rank));

    return newData.map((item) => {
      const oldRank = oldRankMap.get(item.username);
      let movement = 0;
      if (oldRank !== undefined) movement = oldRank - item.rank;
      return { ...item, movement };
    });
  };

  // --- 4. API FUNCTIONS ---
  const checkSimStatus = async () => {
    try {
      const status = await getSimulationStatus();
      setSimActive(status.active);
    } catch (e) {}
  };

  const handleToggleSim = async () => {
    const newState = !simActive;
    setSimActive(newState); 
    await toggleSimulation(newState);
    if(newState) alert("🚀 Simulation Started!");
    else alert("🛑 Simulation Stopped.");
  };

  const loadLeaderboardSilent = async () => {
    // Only update if user is at the top of the list
    if (pageRef.current > 1) return; 

    try {
      const response = await getLeaderboard(1, PAGE_SIZE);
      
      setData((prevData) => {
        const updatedTop = processDataWithMovement(response.data, prevData);
        // Remove duplicates just in case
        const topUsernames = new Set(updatedTop.map(u => u.username));
        const keptExisting = prevData.filter(u => !topUsernames.has(u.username));
        return [...updatedTop, ...keptExisting];
      });
      setTotal(response.total);
    } catch (error) { console.log('Silent update failed', error); }
  };

  const loadLeaderboard = async () => {
    try {
      if (page === 1) setLoading(true);
      const response = await getLeaderboard(1, PAGE_SIZE);
      const processed = response.data.map(i => ({ ...i, movement: 0 }));
      setData(processed);
      setTotal(response.total);
      setPage(1);
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  const loadMore = async () => {
    if (data.length >= total || loadingMoreRef.current) return;
    
    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const nextPage = page + 1;
      const response = await getLeaderboard(nextPage, PAGE_SIZE);
      
      const newData = response.data.map(i => ({ ...i, movement: 0 }));
      
      setData((prevData) => {
        const existingUsernames = new Set(prevData.map(u => u.username));
        const uniqueNewData = newData.filter(u => !existingUsernames.has(u.username));
        return [...prevData, ...uniqueNewData];
      });

      setPage(nextPage);
    } catch (error) { 
        console.error('Failed to load more:', error); 
    } finally {
        loadingMoreRef.current = false;
        setLoadingMore(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await loadLeaderboard();
    setRefreshing(false);
  };

  // --- 5. RENDER COMPONENTS ---
  const getItemLayout = (data, index) => ({
    length: 70, offset: 70 * index, index,
  });

  const renderItem = useCallback(({ item }) => (
    <LeaderboardItem
      rank={item.rank}
      username={item.username}
      rating={item.rating}
      movement={item.movement}
    />
  ), []);

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTopRow}>
        <View>
          <Text style={styles.headerTitle}>Global Leaderboard</Text>
          <Text style={styles.headerSubtitle}>{total.toLocaleString()} Players • Live</Text>
        </View>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.iconBtn}>
          <Animated.View style={{ opacity: blinkAnim }}>
             <Ionicons name="information-circle" size={32} color="#3B82F6" />
          </Animated.View>
        </TouchableOpacity>
      </View>
      <TouchableOpacity 
        style={[styles.simButton, simActive ? styles.stopBtn : styles.startBtn]} 
        onPress={handleToggleSim}
      >
        <Ionicons name={simActive ? "stop-circle" : "play-circle"} size={20} color="white" />
        <Text style={styles.simBtnText}>
          {simActive ? "Stop Simulation" : "Start Live Simulation"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return <View style={{ height: 50 }} />;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#3B82F6" />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        // --- COLD START VIEW ---
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3B82F6" style={{ marginBottom: 20 }} />
          
          <Text style={styles.loadingTitle}>Waking up the Server...</Text>
          <Text style={styles.loadingSubtitle}>
            Hosted on Render (Free Tier). It might take 30-50 secs for the "Cold Start".
          </Text>

          {/* Quick Info Box while waiting */}
          <View style={styles.archBox}>
            <Text style={styles.archTitle}>⚡ System Architecture</Text>
            <Text style={styles.archText}>
              • <Text style={{fontWeight:'bold'}}>Frontend:</Text> React Native (Expo){"\n"}
              • <Text style={{fontWeight:'bold'}}>Backend:</Text> Go (Golang) + Gin{"\n"}
              • <Text style={{fontWeight:'bold'}}>Real-Time:</Text> Redis Sorted Sets{"\n"}
              • <Text style={{fontWeight:'bold'}}>Storage:</Text> PostgreSQL
            </Text>
          </View>

          <Text style={styles.loadingTip}>
            Once loaded, tap the <Ionicons name="information-circle" size={14} /> button at top right to see full details!
          </Text>
        </View>
      ) : (
        // --- MAIN LIST VIEW ---
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item) => item.username} 
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          onEndReached={loadMore}
          onEndReachedThreshold={PREFETCH_THRESHOLD}
          getItemLayout={getItemLayout}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={11}
          removeClippedSubviews={true}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
      <InfoModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </View>
  );
};

// --- INFO MODAL COMPONENT ---
const InfoModal = ({ visible, onClose }) => (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
  
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <Text style={styles.modalTitle}>System Architecture</Text>
  
            {/* 1. SIMPLE EXPLANATION */}
            <View style={styles.archSummary}>
              <Text style={styles.modalText}>
                Standard databases crash when sorting millions of scores in real-time. To fix this, we use a <Text style={styles.bold}>Hybrid Architecture</Text>:
              </Text>
              <Text style={styles.bulletPoint}>
                1. <Text style={styles.bold}>PostgreSQL</Text> stores data safely (The Vault).
              </Text>
              <Text style={styles.bulletPoint}>
                2. <Text style={styles.bold}>Redis</Text> sorts users instantly (The Speed).
              </Text>
              <Text style={styles.bulletPoint}>
                3. <Text style={styles.bold}>Go</Text> batches updates to prevent locking.
              </Text>
            </View>
  
            <Text style={styles.sectionHeader}>🛠️ Tech Stack</Text>
  
            {/* 2. ICONS & STACK */}
            <View style={styles.techRow}>
              <Image source={require('../assets/gopher.png')} style={styles.techIcon} />
              <View style={styles.techInfo}>
                <Text style={styles.techLabel}>Backend Engine</Text>
                <Text style={styles.techValue}>Go (Golang) + Gin Framework</Text>
              </View>
            </View>
  
            <View style={styles.techRow}>
              <Image source={require('../assets/post.png')} style={styles.techIcon} />
              <View style={styles.techInfo}>
                <Text style={styles.techLabel}>Persistent Storage</Text>
                <Text style={styles.techValue}>PostgreSQL (Supabase)</Text>
              </View>
            </View>
  
            <View style={styles.techRow}>
              <Image source={require('../assets/uptash.png')} style={styles.techIcon} />
              <View style={styles.techInfo}>
                <Text style={styles.techLabel}>High-Speed Cache</Text>
                <Text style={styles.techValue}>Redis (Sorted Sets)</Text>
              </View>
            </View>
  
            <View style={styles.techRow}>
               <Image source={require('../assets/image.png')} style={styles.techIcon} />
               <View style={styles.techInfo}>
                 <Text style={styles.techLabel}>Cloud Infrastructure</Text>
                 <Text style={styles.techValue}>Render (Backend) + Vercel (Web)</Text>
               </View>
             </View>
  
            {/* 3. SIMULATION EXPLANATION */}
            <Text style={styles.sectionHeader}>⚡ High-Concurrency Demo</Text>
            <Text style={styles.modalText}>
              The "Simulation" isn't just random updates. It demonstrates <Text style={styles.bold}>Batch Processing</Text>.
            </Text>
            <Text style={[styles.modalText, {marginTop: 8}]}>
              Instead of locking the database for every single game, the backend collects updates and writes them in parallel batches. This allows the system to handle <Text style={styles.bold}>thousands of updates per second</Text> with zero lag.
            </Text>
  
            <View style={styles.legendContainer}>
               <Text style={styles.legendItem}>• <Text style={styles.green}>▲ Green</Text> = Rank Up</Text>
               <Text style={styles.legendItem}>• <Text style={styles.red}>▼ Red</Text> = Rank Down</Text>
            </View>
  
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
  
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    
    // --- STYLES FOR COLD START SCREEN ---
    centerContainer: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: 30,
        backgroundColor: '#F9FAFB' 
    },
    loadingTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginBottom: 8 },
    loadingSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 25 },
    loadingTip: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 20, fontStyle: 'italic' },
    
    // Architecture Box (Loading Screen)
    archBox: { 
        backgroundColor: '#EFF6FF', 
        padding: 15, 
        borderRadius: 12, 
        borderWidth: 1, 
        borderColor: '#DBEAFE',
        width: '100%'
    },
    archTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E40AF', marginBottom: 8 },
    archText: { fontSize: 14, color: '#374151', lineHeight: 22 },

    // --- ARCHITECTURE MODAL STYLES ---
    archSummary: {
        backgroundColor: '#F9FAFB',
        padding: 12,
        borderRadius: 8,
        marginBottom: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#3B82F6'
    },
    bulletPoint: {
        fontSize: 14,
        color: '#4B5563',
        marginTop: 4,
        marginLeft: 4
    },

    // ... GENERAL STYLES ...
    header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#E5E7EB', paddingTop: 60 },
    headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
    headerSubtitle: { fontSize: 14, color: '#6B7280' },
    iconBtn: { padding: 5 },
    simButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, marginTop: 5 },
    startBtn: { backgroundColor: '#10B981' }, 
    stopBtn: { backgroundColor: '#EF4444' },  
    simBtnText: { color: 'white', fontWeight: 'bold', marginLeft: 8, fontSize: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '85%', backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '80%' },
    closeButton: { alignSelf: 'flex-end', marginBottom: 10 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
    sectionHeader: { fontSize: 18, fontWeight: '700', marginTop: 15, marginBottom: 10, color: '#374151' },
    modalText: { fontSize: 15, color: '#4B5563', lineHeight: 22 },
    techRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, backgroundColor: '#F3F4F6', padding: 12, borderRadius: 8 },
    techIcon: { width: 50, height: 50, resizeMode: 'contain' }, 
    techInfo: { marginLeft: 15, flex: 1 },
    techLabel: { fontWeight: '700', fontSize: 15 },
    techValue: { color: '#6B7280', fontSize: 14 },
    legendContainer: { marginTop: 15, backgroundColor: '#F3F4F6', padding: 10, borderRadius: 8 },
    legendItem: { fontSize: 14, color: '#374151', marginBottom: 4 },
    bold: { fontWeight: 'bold', color: '#1F2937' },
    green: { color: '#10B981', fontWeight: 'bold' },
    red: { color: '#EF4444', fontWeight: 'bold' },
    footer: { padding: 20, alignItems: 'center' }
  });

export default LeaderboardScreen;