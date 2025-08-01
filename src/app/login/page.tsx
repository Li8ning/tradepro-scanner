"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  VStack,
  Heading,
  Text,
  Input,
  Button,
  Center,
  HStack,
  useToast,
} from "@chakra-ui/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode] = useState(true); // Using dark mode by default to match the main app
  const router = useRouter();
  const toast = useToast();
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        toast({
          title: "Login successful.",
          status: "success",
          duration: 5000,
          isClosable: true,
        });
        router.push('/');
      } else {
        const data = await res.json();
        toast({
          title: "An error occurred.",
          description: data.message || "Something went wrong.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      toast({
        title: "An error occurred.",
        description: "Something went wrong.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box minH="100vh" bg={darkMode ? 'gray.900' : 'gray.100'}>
      <Center minH="100vh" p={4}>
        <Container maxW="md">
          <Box
            bg={darkMode ? 'gray.800' : 'white'}
            p={8}
            borderRadius="lg"
            boxShadow="lg"
            w="full"
          >
            <VStack gap={6} align="stretch">
              <Heading
                size="xl"
                textAlign="center"
                color={darkMode ? 'white' : 'gray.900'}
              >
                Login
              </Heading>
              
              <Box as="form" onSubmit={handleSubmit}>
                <VStack gap={4} align="stretch">
                  <Box>
                    <label
                      htmlFor="email"
                      style={{
                        color: darkMode ? '#D1D5DB' : '#374151',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        marginBottom: '8px',
                        display: 'block'
                      }}
                    >
                      Email
                    </label>
                    <Input
                      ref={emailInputRef}
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      bg={darkMode ? 'gray.700' : 'gray.200'}
                      border="1px"
                      borderColor={darkMode ? 'gray.600' : 'gray.300'}
                      color={darkMode ? 'white' : 'gray.900'}
                      _placeholder={{ color: darkMode ? 'gray.400' : 'gray.500' }}
                      _focus={{
                        borderColor: "blue.500",
                        boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
                      }}
                      required
                    />
                  </Box>

                  <Box>
                    <label
                      htmlFor="password"
                      style={{
                        color: darkMode ? '#D1D5DB' : '#374151',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        marginBottom: '8px',
                        display: 'block'
                      }}
                    >
                      Password
                    </label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      bg={darkMode ? 'gray.700' : 'gray.200'}
                      border="1px"
                      borderColor={darkMode ? 'gray.600' : 'gray.300'}
                      color={darkMode ? 'white' : 'gray.900'}
                      _placeholder={{ color: darkMode ? 'gray.400' : 'gray.500' }}
                      _focus={{
                        borderColor: "blue.500",
                        boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
                      }}
                      required
                    />
                  </Box>

                  <VStack gap={4} align="stretch" mt={2}>
                    <Button
                      type="submit"
                      colorScheme="blue"
                      size="lg"
                      fontWeight="bold"
                      isLoading={isLoading}
                    >
                      Sign In
                    </Button>
                    
                    <HStack justify="center">
                      <Text
                        fontSize="sm"
                        color={darkMode ? 'gray.400' : 'gray.600'}
                      >
                        Don't have an account?
                      </Text>
                      <Link href="/signup">
                        <Text
                          fontSize="sm"
                          color="blue.500"
                          fontWeight="bold"
                          _hover={{ color: "blue.600", textDecoration: "underline" }}
                        >
                          Sign Up
                        </Text>
                      </Link>
                    </HStack>
                  </VStack>
                </VStack>
              </Box>
            </VStack>
          </Box>
        </Container>
      </Center>
    </Box>
  );
}