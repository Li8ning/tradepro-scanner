import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const watchlistsFilePath = path.join('/tmp', 'watchlists.json');

interface Watchlists {
  [userId: string]: string[];
}

async function readWatchlists(): Promise<Watchlists> {
  try {
    const watchlistsData = await fs.promises.readFile(watchlistsFilePath, 'utf-8');
    return JSON.parse(watchlistsData);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      const originalPath = path.join(process.cwd(), 'src', 'lib', 'data', 'watchlists.json');
      try {
        const originalData = await fs.promises.readFile(originalPath, 'utf-8');
        await fs.promises.writeFile(watchlistsFilePath, originalData);
        return JSON.parse(originalData);
      } catch (readError) {
        return {};
      }
    }
    throw error;
  }
}

async function writeWatchlists(watchlists: Watchlists): Promise<void> {
  await fs.promises.writeFile(watchlistsFilePath, JSON.stringify(watchlists, null, 2));
}

async function getUserIdFromToken(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) {
    return null;
  }
  try {
    const decoded = jwt.verify(token, 'your-secret-key') as { userId: number };
    return decoded.userId;
  } catch (error) {
    return null;
  }
}

export async function GET() {
  const userId = await getUserIdFromToken();
  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const watchlists = await readWatchlists();
  const userWatchlist = watchlists[userId] || [];

  return NextResponse.json(userWatchlist);
}

export async function POST(request: Request) {
  const userId = await getUserIdFromToken();
  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { symbol } = await request.json();
  if (!symbol) {
    return NextResponse.json({ message: 'Stock symbol is required' }, { status: 400 });
  }

  const watchlists = await readWatchlists();
  const userWatchlist = watchlists[userId] || [];

  if (!userWatchlist.includes(symbol)) {
    userWatchlist.push(symbol);
    watchlists[userId] = userWatchlist;
    await writeWatchlists(watchlists);
  }

  return NextResponse.json(userWatchlist);
}

export async function DELETE(request: Request) {
  const userId = await getUserIdFromToken();
  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { symbol } = await request.json();
  if (!symbol) {
    return NextResponse.json({ message: 'Stock symbol is required' }, { status: 400 });
  }

  const watchlists = await readWatchlists();
  let userWatchlist = watchlists[userId] || [];

  if (userWatchlist.includes(symbol)) {
    userWatchlist = userWatchlist.filter((s) => s !== symbol);
    watchlists[userId] = userWatchlist;
    await writeWatchlists(watchlists);
  }

  return NextResponse.json(userWatchlist);
}