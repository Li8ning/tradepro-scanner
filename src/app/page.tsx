"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
  Input,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Avatar,
  VStack,
  HStack,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  IconButton,
  useColorMode,
  useColorModeValue,
  InputGroup,
  InputLeftElement,
  Grid,
  GridItem,
  Center,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  useDisclosure,
} from "@chakra-ui/react";
import { SearchIcon, SunIcon, MoonIcon } from "@chakra-ui/icons";
import Chart from "../components/Chart";

interface TrendData {
  trend: string;
  confidence: number;
  startDate: string;
}

interface SupertrendResult {
  value: number;
  direction: 'up' | 'down';
  signal: 'buy' | 'sell' | 'hold';
  atr: number;
  basicUpperBand: number;
  basicLowerBand: number;
}

interface Asset {
  name: string;
  symbol: string;
  type: "stock" | "crypto";
  price?: number;
  "45M": TrendData;
  "2H": TrendData;
  "4H": TrendData;
  "1D": TrendData;
  "3D": TrendData;
  "1W": TrendData;
  supertrend?: {
    "45M": SupertrendResult | null;
    "2H": SupertrendResult | null;
    "4H": SupertrendResult | null;
    "1D": SupertrendResult | null;
    "3D": SupertrendResult | null;
    "1W": SupertrendResult | null;
  };
  ohlc?: { time: string; open: number; high: number; low: number; close: number }[];
}

export default function Home() {
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [assetType, setAssetType] = useState<"all" | "stock" | "crypto">("stock");
  const [searchTerm, setSearchTerm] = useState("");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  // All hooks must be called at the top level, in the same order every time
  const { colorMode, toggleColorMode } = useColorMode();
  const bgColor = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const textColor = useColorModeValue("gray.900", "white");
  const mutedTextColor = useColorModeValue("gray.600", "gray.400");
  const tableHeaderBg = useColorModeValue("gray.50", "gray.700");
  const hoverBg = useColorModeValue("gray.50", "gray.700");
  const toggleBg = useColorModeValue("gray.100", "gray.700");
  const emptyStateBg = useColorModeValue("gray.100", "gray.700");
  const watchlistBg = useColorModeValue("yellow.100", "yellow.800");

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/data');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Combine crypto and stock data
        const combinedAssets: Asset[] = [
          ...data.crypto.map((asset: any) => ({
            ...asset,
            type: "crypto" as const,
          })),
          ...data.stocks.map((asset: any) => ({
            ...asset,
            type: "stock" as const,
          }))
        ];
        
        setAllAssets(combinedAssets);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch watchlist
  useEffect(() => {
    const fetchWatchlist = async () => {
      try {
        const res = await fetch('/api/watchlist');
        if (res.ok) {
          const data = await res.json();
          setWatchlist(data || []);
        } else {
          console.error('Failed to fetch watchlist');
        }
      } catch (error) {
        console.error('Error fetching watchlist:', error);
      }
    };
    fetchWatchlist();
  }, []);

  const filteredAssets = useMemo(() => {
    let filtered = allAssets;

    if (assetType !== "all") {
      filtered = filtered.filter((asset) => asset.type === assetType);
    }

    if (searchTerm) {
      filtered = filtered.filter((asset) =>
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.symbol.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [allAssets, assetType, searchTerm]);

  const toggleWatchlist = async (assetSymbol: string) => {
    const isWatched = watchlist.includes(assetSymbol);
    const newWatchlist = isWatched
      ? watchlist.filter((symbol) => symbol !== assetSymbol)
      : [...watchlist, assetSymbol];

    // Optimistic update
    setWatchlist(newWatchlist);

    try {
      await fetch('/api/watchlist', {
        method: isWatched ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: assetSymbol }),
      });
    } catch (error) {
      console.error("Failed to update watchlist", error);
      // Revert on error
      setWatchlist(watchlist);
    }
  };

  const handleRowClick = (asset: Asset) => {
    setSelectedAsset(asset);
    onOpen();
  };

  const getTrendDisplay = (trendData: TrendData | undefined) => {
    if (!trendData) {
      return {
        icon: "→",
        label: "No Data",
        colorScheme: "gray",
        confidence: 0,
        date: "N/A"
      };
    }

    const { trend, confidence, startDate } = trendData;
    
    switch (trend) {
      case "uptrend":
        return {
          icon: "↗",
          label: "Uptrend",
          colorScheme: "green",
          confidence,
          date: startDate
        };
      case "downtrend":
        return {
          icon: "↘",
          label: "Downtrend",
          colorScheme: "red",
          confidence,
          date: startDate
        };
      case "sideways":
        return {
          icon: "→",
          label: "Sideways",
          colorScheme: "gray",
          confidence,
          date: startDate
        };
      default:
        return {
          icon: "→",
          label: "Unknown",
          colorScheme: "gray",
          confidence: 0,
          date: "N/A"
        };
    }
  };

  const getSupertrendDisplay = (supertrendData: SupertrendResult | null | undefined) => {
    if (!supertrendData) {
      return {
        icon: "—",
        label: "No Data",
        colorScheme: "gray",
        signal: "hold",
        value: 0,
        atr: 0
      };
    }

    const { direction, signal, value, atr } = supertrendData;
    
    let colorScheme = "gray";
    let icon = "—";
    let label = "Hold";

    if (signal === "buy") {
      colorScheme = "green";
      icon = "🚀";
      label = "BUY";
    } else if (signal === "sell") {
      colorScheme = "red";
      icon = "📉";
      label = "SELL";
    } else if (direction === "up") {
      colorScheme = "green";
      icon = "📈";
      label = "Bullish";
    } else if (direction === "down") {
      colorScheme = "red";
      icon = "📉";
      label = "Bearish";
    }

    return {
      icon,
      label,
      colorScheme,
      signal,
      value: Math.round(value * 100) / 100,
      atr: Math.round(atr * 100) / 100
    };
  };

  if (loading) {
    return (
      <Box minH="100vh" bg={bgColor}>
        <Center minH="100vh">
          <VStack spacing={4}>
            <Spinner size="lg" color="blue.500" thickness="3px" />
            <Text fontSize="lg" fontWeight="medium" color={textColor}>
              Loading Market Data...
            </Text>
          </VStack>
        </Center>
      </Box>
    );
  }

  if (error) {
    return (
      <Box minH="100vh" bg={bgColor}>
        <Center minH="100vh" p={4}>
          <Alert
            status="error"
            variant="subtle"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            textAlign="center"
            height="200px"
            maxW="md"
            borderRadius="lg"
          >
            <AlertIcon boxSize="40px" mr={0} />
            <AlertTitle mt={4} mb={1} fontSize="lg">
              Connection Error
            </AlertTitle>
            <AlertDescription maxWidth="sm" mb={4}>
              {error}
            </AlertDescription>
            <Button colorScheme="blue" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </Alert>
        </Center>
      </Box>
    );
  }

  return (
    <Box minH="100vh" bg={bgColor}>
      {/* Top Bar */}
      <Box
        bg={cardBg}
        borderBottom="1px"
        borderColor={borderColor}
        position="sticky"
        top={0}
        zIndex={50}
      >
        <Container maxW="7xl" px={4}>
          <Flex align="center" justify="space-between" h={16}>
            {/* Logo */}
            <HStack spacing={3}>
              <Box
                w={8}
                h={8}
                bgGradient="linear(to-br, blue.500, purple.600)"
                borderRadius="lg"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Text color="white" fontWeight="bold" fontSize="sm">
                  TS
                </Text>
              </Box>
              <Heading size="lg" color={textColor}>
                TradeScan
              </Heading>
            </HStack>

            {/* Center Controls */}
            <HStack spacing={4}>
              {/* Search Bar */}
              <InputGroup w="64">
                <InputLeftElement pointerEvents="none">
                  <SearchIcon color={mutedTextColor} />
                </InputLeftElement>
                <Input
                  placeholder="Search assets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  bg={cardBg}
                  borderColor={borderColor}
                  _focus={{
                    borderColor: "blue.500",
                    boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
                  }}
                />
              </InputGroup>
            </HStack>

            {/* Right Controls */}
            <HStack spacing={3}>
              {/* Dark Mode Toggle */}
              <IconButton
                aria-label="Toggle color mode"
                icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
                onClick={toggleColorMode}
                variant="ghost"
                size="md"
              />
            </HStack>
          </Flex>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxW="7xl" px={4} py={6}>
        {/* Desktop Table */}
        <Box display={{ base: "none", md: "block" }}>
          <Box
            bg={cardBg}
            border="1px"
            borderColor={borderColor}
            borderRadius="lg"
            overflow="hidden"
            shadow="sm"
          >
            <Box overflowX="auto" maxW="100%">
              <Table variant="simple" minW="1800px">
                <Thead bg={tableHeaderBg}>
                  <Tr>
                    <Th color={mutedTextColor}>Asset</Th>
                    <Th color={mutedTextColor} isNumeric>Price</Th>
                    <Th color={mutedTextColor} textAlign="center">45M Trend</Th>
                    <Th color={mutedTextColor} textAlign="center">45M ST</Th>
                    <Th color={mutedTextColor} textAlign="center">2H Trend</Th>
                    <Th color={mutedTextColor} textAlign="center">2H ST</Th>
                    <Th color={mutedTextColor} textAlign="center">4H Trend</Th>
                    <Th color={mutedTextColor} textAlign="center">4H ST</Th>
                    <Th color={mutedTextColor} textAlign="center">1D Trend</Th>
                    <Th color={mutedTextColor} textAlign="center">1D ST</Th>
                    <Th color={mutedTextColor} textAlign="center">3D Trend</Th>
                    <Th color={mutedTextColor} textAlign="center">3D ST</Th>
                    <Th color={mutedTextColor} textAlign="center">1W Trend</Th>
                    <Th color={mutedTextColor} textAlign="center">1W ST</Th>
                    <Th color={mutedTextColor} textAlign="center">Watchlist</Th>
                  </Tr>
                </Thead>
              <Tbody>
                {filteredAssets.map((asset) => {
                  const trend45M = getTrendDisplay(asset["45M"]);
                  const trend2H = getTrendDisplay(asset["2H"]);
                  const trend4H = getTrendDisplay(asset["4H"]);
                  const trend1D = getTrendDisplay(asset["1D"]);
                  const trend3D = getTrendDisplay(asset["3D"]);
                  const trend1W = getTrendDisplay(asset["1W"]);
                  
                  const supertrend45M = getSupertrendDisplay(asset.supertrend?.["45M"]);
                  const supertrend2H = getSupertrendDisplay(asset.supertrend?.["2H"]);
                  const supertrend4H = getSupertrendDisplay(asset.supertrend?.["4H"]);
                  const supertrend1D = getSupertrendDisplay(asset.supertrend?.["1D"]);
                  const supertrend3D = getSupertrendDisplay(asset.supertrend?.["3D"]);
                  const supertrend1W = getSupertrendDisplay(asset.supertrend?.["1W"]);

                  return (
                    <Tr key={asset.symbol} _hover={{ bg: hoverBg, cursor: 'pointer' }} onClick={() => handleRowClick(asset)} bg={watchlist.includes(asset.symbol) ? watchlistBg : undefined}>
                      <Td>
                        <HStack>
                          <Avatar
                            size="sm"
                            name={asset.symbol}
                            bg={asset.type === 'crypto' ? 'orange.500' : 'blue.500'}
                            color="white"
                          />
                          <VStack align="start" spacing={0}>
                            <Text fontWeight="semibold" color={textColor}>
                              {asset.name}
                            </Text>
                            <HStack spacing={2}>
                              <Text fontSize="sm" color={mutedTextColor}>
                                {asset.symbol}
                              </Text>
                              <Badge
                                colorScheme={asset.type === 'crypto' ? 'orange' : 'blue'}
                                size="sm"
                              >
                                {asset.type.toUpperCase()}
                              </Badge>
                            </HStack>
                          </VStack>
                        </HStack>
                      </Td>
                      <Td isNumeric>
                        <Text fontWeight="semibold" color={textColor}>
                          {asset.price ? `$${asset.price.toLocaleString()}` : 'N/A'}
                        </Text>
                      </Td>
                      
                      {/* 45M Trend */}
                      <Td textAlign="center">
                        <Badge colorScheme={trend45M.colorScheme} variant="subtle" px={2} py={1} borderRadius="md">
                          <VStack spacing={0}>
                            <HStack spacing={1}>
                              <Text fontSize="sm">{trend45M.icon}</Text>
                              <Text fontSize="xs" fontWeight="medium">{trend45M.label}</Text>
                            </HStack>
                            <Text fontSize="xs" opacity={0.8}>{trend45M.confidence}%</Text>
                          </VStack>
                        </Badge>
                      </Td>
                      
                      {/* 45M Supertrend */}
                      <Td textAlign="center">
                        <Badge
                          colorScheme={supertrend45M.colorScheme}
                          variant={supertrend45M.signal === 'buy' || supertrend45M.signal === 'sell' ? 'solid' : 'subtle'}
                          px={2} py={1} borderRadius="md" fontSize="xs"
                        >
                          <VStack spacing={0}>
                            <HStack spacing={1}>
                              <Text fontSize="sm">{supertrend45M.icon}</Text>
                              <Text fontSize="xs" fontWeight="bold">{supertrend45M.label}</Text>
                            </HStack>
                            {supertrend45M.value > 0 && (
                              <Text fontSize="xs" opacity={0.8}>${supertrend45M.value.toLocaleString()}</Text>
                            )}
                          </VStack>
                        </Badge>
                      </Td>
                      
                      {/* 2H Trend */}
                      <Td textAlign="center">
                        <Badge colorScheme={trend2H.colorScheme} variant="subtle" px={2} py={1} borderRadius="md">
                          <VStack spacing={0}>
                            <HStack spacing={1}>
                              <Text fontSize="sm">{trend2H.icon}</Text>
                              <Text fontSize="xs" fontWeight="medium">{trend2H.label}</Text>
                            </HStack>
                            <Text fontSize="xs" opacity={0.8}>{trend2H.confidence}%</Text>
                          </VStack>
                        </Badge>
                      </Td>
                      
                      {/* 2H Supertrend */}
                      <Td textAlign="center">
                        <Badge
                          colorScheme={supertrend2H.colorScheme}
                          variant={supertrend2H.signal === 'buy' || supertrend2H.signal === 'sell' ? 'solid' : 'subtle'}
                          px={2} py={1} borderRadius="md" fontSize="xs"
                        >
                          <VStack spacing={0}>
                            <HStack spacing={1}>
                              <Text fontSize="sm">{supertrend2H.icon}</Text>
                              <Text fontSize="xs" fontWeight="bold">{supertrend2H.label}</Text>
                            </HStack>
                            {supertrend2H.value > 0 && (
                              <Text fontSize="xs" opacity={0.8}>${supertrend2H.value.toLocaleString()}</Text>
                            )}
                          </VStack>
                        </Badge>
                      </Td>
                      
                      {/* 4H Trend */}
                      <Td textAlign="center">
                        <Badge colorScheme={trend4H.colorScheme} variant="subtle" px={2} py={1} borderRadius="md">
                          <VStack spacing={0}>
                            <HStack spacing={1}>
                              <Text fontSize="sm">{trend4H.icon}</Text>
                              <Text fontSize="xs" fontWeight="medium">{trend4H.label}</Text>
                            </HStack>
                            <Text fontSize="xs" opacity={0.8}>{trend4H.confidence}%</Text>
                          </VStack>
                        </Badge>
                      </Td>
                      
                      {/* 4H Supertrend */}
                      <Td textAlign="center">
                        <Badge
                          colorScheme={supertrend4H.colorScheme}
                          variant={supertrend4H.signal === 'buy' || supertrend4H.signal === 'sell' ? 'solid' : 'subtle'}
                          px={2} py={1} borderRadius="md" fontSize="xs"
                        >
                          <VStack spacing={0}>
                            <HStack spacing={1}>
                              <Text fontSize="sm">{supertrend4H.icon}</Text>
                              <Text fontSize="xs" fontWeight="bold">{supertrend4H.label}</Text>
                            </HStack>
                            {supertrend4H.value > 0 && (
                              <Text fontSize="xs" opacity={0.8}>${supertrend4H.value.toLocaleString()}</Text>
                            )}
                          </VStack>
                        </Badge>
                      </Td>
                      
                      {/* 1D Trend */}
                      <Td textAlign="center">
                        <Badge colorScheme={trend1D.colorScheme} variant="subtle" px={2} py={1} borderRadius="md">
                          <VStack spacing={0}>
                            <HStack spacing={1}>
                              <Text fontSize="sm">{trend1D.icon}</Text>
                              <Text fontSize="xs" fontWeight="medium">{trend1D.label}</Text>
                            </HStack>
                            <Text fontSize="xs" opacity={0.8}>{trend1D.confidence}%</Text>
                          </VStack>
                        </Badge>
                      </Td>
                      
                      {/* 1D Supertrend */}
                      <Td textAlign="center">
                        <Badge
                          colorScheme={supertrend1D.colorScheme}
                          variant={supertrend1D.signal === 'buy' || supertrend1D.signal === 'sell' ? 'solid' : 'subtle'}
                          px={2} py={1} borderRadius="md" fontSize="xs"
                        >
                          <VStack spacing={0}>
                            <HStack spacing={1}>
                              <Text fontSize="sm">{supertrend1D.icon}</Text>
                              <Text fontSize="xs" fontWeight="bold">{supertrend1D.label}</Text>
                            </HStack>
                            {supertrend1D.value > 0 && (
                              <Text fontSize="xs" opacity={0.8}>${supertrend1D.value.toLocaleString()}</Text>
                            )}
                          </VStack>
                        </Badge>
                      </Td>
                      
                      {/* 3D Trend */}
                      <Td textAlign="center">
                        <Badge colorScheme={trend3D.colorScheme} variant="subtle" px={2} py={1} borderRadius="md">
                          <VStack spacing={0}>
                            <HStack spacing={1}>
                              <Text fontSize="sm">{trend3D.icon}</Text>
                              <Text fontSize="xs" fontWeight="medium">{trend3D.label}</Text>
                            </HStack>
                            <Text fontSize="xs" opacity={0.8}>{trend3D.confidence}%</Text>
                          </VStack>
                        </Badge>
                      </Td>
                      
                      {/* 3D Supertrend */}
                      <Td textAlign="center">
                        <Badge
                          colorScheme={supertrend3D.colorScheme}
                          variant={supertrend3D.signal === 'buy' || supertrend3D.signal === 'sell' ? 'solid' : 'subtle'}
                          px={2} py={1} borderRadius="md" fontSize="xs"
                        >
                          <VStack spacing={0}>
                            <HStack spacing={1}>
                              <Text fontSize="sm">{supertrend3D.icon}</Text>
                              <Text fontSize="xs" fontWeight="bold">{supertrend3D.label}</Text>
                            </HStack>
                            {supertrend3D.value > 0 && (
                              <Text fontSize="xs" opacity={0.8}>${supertrend3D.value.toLocaleString()}</Text>
                            )}
                          </VStack>
                        </Badge>
                      </Td>
                      
                      {/* 1W Trend */}
                      <Td textAlign="center">
                        <Badge colorScheme={trend1W.colorScheme} variant="subtle" px={2} py={1} borderRadius="md">
                          <VStack spacing={0}>
                            <HStack spacing={1}>
                              <Text fontSize="sm">{trend1W.icon}</Text>
                              <Text fontSize="xs" fontWeight="medium">{trend1W.label}</Text>
                            </HStack>
                            <Text fontSize="xs" opacity={0.8}>{trend1W.confidence}%</Text>
                          </VStack>
                        </Badge>
                      </Td>
                      
                      {/* 1W Supertrend */}
                      <Td textAlign="center">
                        <Badge
                          colorScheme={supertrend1W.colorScheme}
                          variant={supertrend1W.signal === 'buy' || supertrend1W.signal === 'sell' ? 'solid' : 'subtle'}
                          px={2} py={1} borderRadius="md" fontSize="xs"
                        >
                          <VStack spacing={0}>
                            <HStack spacing={1}>
                              <Text fontSize="sm">{supertrend1W.icon}</Text>
                              <Text fontSize="xs" fontWeight="bold">{supertrend1W.label}</Text>
                            </HStack>
                            {supertrend1W.value > 0 && (
                              <Text fontSize="xs" opacity={0.8}>${supertrend1W.value.toLocaleString()}</Text>
                            )}
                          </VStack>
                        </Badge>
                      </Td>
                      
                      <Td textAlign="center">
                        <Button
                          size="sm"
                          variant={watchlist.includes(asset.symbol) ? "solid" : "outline"}
                          colorScheme={watchlist.includes(asset.symbol) ? "yellow" : "gray"}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWatchlist(asset.symbol);
                          }}
                        >
                          {watchlist.includes(asset.symbol) ? '★ In Watchlist' : '☆ Add to Watchlist'}
                        </Button>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
              </Table>
            </Box>
          </Box>
        </Box>

        {/* Mobile Cards */}
        <VStack spacing={4} display={{ base: "flex", md: "none" }}>
          {filteredAssets.map((asset) => {
            const supertrend1D = getSupertrendDisplay(asset.supertrend?.["1D"]);
            
            return (
              <Box
                key={asset.symbol}
                w="full"
                bg={cardBg}
                border="1px"
                borderColor={borderColor}
                borderRadius="lg"
                p={4}
                shadow="sm"
                onClick={() => handleRowClick(asset)}
              >
                <Flex justify="space-between" align="start" mb={3}>
                  <HStack>
                    <Avatar
                      size="sm"
                      name={asset.symbol}
                      bg={asset.type === 'crypto' ? 'orange.500' : 'blue.500'}
                      color="white"
                    />
                    <VStack align="start" spacing={0}>
                      <Text fontWeight="semibold" color={textColor}>
                        {asset.name}
                      </Text>
                      <Text fontSize="sm" color={mutedTextColor}>
                        {asset.symbol}
                      </Text>
                    </VStack>
                  </HStack>
                  <VStack align="end" spacing={1}>
                    <Text fontWeight="semibold" color={textColor}>
                      {asset.price ? `$${asset.price.toLocaleString()}` : 'N/A'}
                    </Text>
                    <Button
                      size="xs"
                      variant={watchlist.includes(asset.symbol) ? "solid" : "outline"}
                      colorScheme={watchlist.includes(asset.symbol) ? "yellow" : "gray"}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWatchlist(asset.symbol);
                      }}
                    >
                      {watchlist.includes(asset.symbol) ? '★' : '☆'}
                    </Button>
                  </VStack>
                </Flex>
                
                {/* Supertrend Indicator */}
                <Box mb={3} p={2} bg={tableHeaderBg} borderRadius="md">
                  <HStack justify="space-between">
                    <Text fontSize="xs" fontWeight="medium" color={mutedTextColor}>
                      Supertrend Signal
                    </Text>
                    <Badge
                      colorScheme={supertrend1D.colorScheme}
                      variant={supertrend1D.signal === 'buy' || supertrend1D.signal === 'sell' ? 'solid' : 'subtle'}
                      fontSize="xs"
                    >
                      <HStack spacing={1}>
                        <Text>{supertrend1D.icon}</Text>
                        <Text fontWeight="bold">{supertrend1D.label}</Text>
                      </HStack>
                    </Badge>
                  </HStack>
                  {supertrend1D.value > 0 && (
                    <Text fontSize="xs" color={mutedTextColor} mt={1}>
                      Value: ${supertrend1D.value.toLocaleString()} | ATR: {supertrend1D.atr}
                    </Text>
                  )}
                </Box>
                
                <Grid templateColumns="repeat(3, 1fr)" gap={2} mb={2}>
                  {[
                    { label: '45M', trend: getTrendDisplay(asset["45M"]) },
                    { label: '2H', trend: getTrendDisplay(asset["2H"]) },
                    { label: '4H', trend: getTrendDisplay(asset["4H"]) }
                  ].map(({ label, trend }) => (
                    <GridItem key={label}>
                      <VStack spacing={1}>
                        <Text fontSize="xs" fontWeight="medium" color={mutedTextColor}>
                          {label}
                        </Text>
                        <Badge
                          colorScheme={trend.colorScheme}
                          variant="subtle"
                          fontSize="xs"
                        >
                          {trend.icon}
                        </Badge>
                        <Text fontSize="xs" color={mutedTextColor}>
                          {trend.confidence}%
                        </Text>
                      </VStack>
                    </GridItem>
                  ))}
                </Grid>
                
                <Grid templateColumns="repeat(3, 1fr)" gap={2}>
                  {[
                    { label: '1D', trend: getTrendDisplay(asset["1D"]) },
                    { label: '3D', trend: getTrendDisplay(asset["3D"]) },
                    { label: '1W', trend: getTrendDisplay(asset["1W"]) }
                  ].map(({ label, trend }) => (
                    <GridItem key={label}>
                      <VStack spacing={1}>
                        <Text fontSize="xs" fontWeight="medium" color={mutedTextColor}>
                          {label}
                        </Text>
                        <Badge
                          colorScheme={trend.colorScheme}
                          variant="subtle"
                          fontSize="xs"
                        >
                          {trend.icon}
                        </Badge>
                        <Text fontSize="xs" color={mutedTextColor}>
                          {trend.confidence}%
                        </Text>
                      </VStack>
                    </GridItem>
                  ))}
                </Grid>
              </Box>
            );
          })}
        </VStack>

        {/* Empty State */}
        {filteredAssets.length === 0 && (
          <Box
            bg={cardBg}
            border="1px"
            borderColor={borderColor}
            borderRadius="lg"
            p={12}
            textAlign="center"
          >
            <Center>
              <VStack spacing={4}>
                <Box
                  w={12}
                  h={12}
                  bg={emptyStateBg}
                  borderRadius="full"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <SearchIcon color={mutedTextColor} boxSize={6} />
                </Box>
                <Heading size="md" color={textColor}>
                  No assets found
                </Heading>
                <Text color={mutedTextColor} textAlign="center">
                  Try adjusting your search or filter criteria.
                </Text>
              </VStack>
            </Center>
          </Box>
        )}
      </Container>

      {/* Chart Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="4xl">
        <ModalOverlay />
        <ModalContent bg={cardBg}>
          <ModalHeader>{selectedAsset?.name} ({selectedAsset?.symbol})</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedAsset && (
              <Chart
                data={selectedAsset.ohlc || []}
                supertrend={
                  Object.entries(selectedAsset.supertrend || {})
                    .map(([key, value]) => {
                      if (!value) return null;
                      return {
                        time: new Date().toISOString(), // This is a placeholder
                        value: value.value,
                        color: value.direction === 'up' ? '#26a69a' : '#ef5350',
                      };
                    })
                    .filter(Boolean) as any
                }
                indicatorLogic="Buy when the price crosses above the green line. Sell when the price crosses below the red line."
              />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}
