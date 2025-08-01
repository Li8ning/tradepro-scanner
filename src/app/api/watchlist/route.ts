import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { sql } from '@vercel/postgres';

async function getUserIdFromToken(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) {
    return null;
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as { userId: number };
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

  try {
    const { rows } = await sql`
      SELECT symbol FROM watchlists WHERE user_id = ${userId}
    `;
    const symbols = rows.map((row) => row.symbol);
    return NextResponse.json(symbols);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
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

  try {
    await sql`
      INSERT INTO watchlists (user_id, symbol)
      VALUES (${userId}, ${symbol})
      ON CONFLICT (user_id, symbol) DO NOTHING
    `;

    const { rows } = await sql`
      SELECT symbol FROM watchlists WHERE user_id = ${userId}
    `;
    const symbols = rows.map((row) => row.symbol);
    return NextResponse.json(symbols);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
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

  try {
    await sql`
      DELETE FROM watchlists WHERE user_id = ${userId} AND symbol = ${symbol}
    `;

    const { rows } = await sql`
      SELECT symbol FROM watchlists WHERE user_id = ${userId}
    `;
    const symbols = rows.map((row) => row.symbol);
    return NextResponse.json(symbols);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}