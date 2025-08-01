import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const usersFilePath = path.join(process.cwd(), 'src', 'lib', 'data', 'tmp', 'users.json');

interface User {
  id: number;
  email: string;
  password?: string;
}

async function readUsers(): Promise<User[]> {
  try {
    const usersData = await fs.promises.readFile(usersFilePath, 'utf-8');
    return JSON.parse(usersData);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      const originalPath = path.join(process.cwd(), 'src', 'lib', 'data', 'users.json');
      try {
        const originalData = await fs.promises.readFile(originalPath, 'utf-8');
        const tmpDir = path.dirname(usersFilePath);
        if (!fs.existsSync(tmpDir)) {
          await fs.promises.mkdir(tmpDir, { recursive: true });
        }
        await fs.promises.writeFile(usersFilePath, originalData);
        return JSON.parse(originalData);
      } catch (readError) {
        return [];
      }
    }
    throw error;
  }
}

async function writeUsers(users: User[]) {
  await fs.promises.writeFile(usersFilePath, JSON.stringify(users, null, 2));
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
    }

    const users = await readUsers();

    const userExists = users.find((user: User) => user.email === email);

    if (userExists) {
      return NextResponse.json({ message: 'User already exists' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser: User = {
      id: users.length + 1,
      email,
      password: hashedPassword,
    };

    users.push(newUser);
    await writeUsers(users);

    return NextResponse.json({ message: 'User created successfully' }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}