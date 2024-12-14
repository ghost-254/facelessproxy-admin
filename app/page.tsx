'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Users, HardDrive, DollarSign, Plus, Eye, Edit, Trash2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { collection, addDoc, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebaseConfig"
import { doc, deleteDoc } from "firebase/firestore"
import Footer from '@/components/Footer'

interface SubUser {
  id: string; // Sub-user ID
  label: string; // Name/label of the sub-user
  login: string; // Sub-user login
  password: string; // Sub-user password
  remainingTraffic: number; // Remaining traffic for the sub-user
  balance_format: string; // User balance in a readable format
  threads: number; // Number of threads assigned to the sub-user
  pool_type: string; // Type of proxy pool assigned to the sub-user
}


interface UsageData {
  name: string;
  usage: number;
}

export default function AdminDashboard() {
  const [totalSubUsers, setTotalSubUsers] = useState<number>(0)
  const [totalTraffic, setTotalTraffic] = useState<number>(0)
  const [remainingBalance, setRemainingBalance] = useState<number>(0)
  const [usageData, setUsageData] = useState<UsageData[]>([])
  const [subUsers, setSubUsers] = useState<SubUser[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const [showNewUserForm, setShowNewUserForm] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newUserPool, setNewUserPool] = useState('')

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
  
        // Fetch sub-users from Firestore
        const subUsersCollection = collection(db, "subUsers");
        const subUsersSnapshot = await getDocs(subUsersCollection);
        const subUsersList = subUsersSnapshot.docs.map(doc => ({
          id: doc.data().id,
          label: doc.data().label,
          login: doc.data().login,
          password: doc.data().password,
          remainingTraffic: doc.data().remainingTraffic,
          balance_format: doc.data().balance_format,
          threads: doc.data().threads,
          pool_type: doc.data().pool_type
        } as SubUser));
  
        // Fetch other data from APIs
        const [totalTrafficRes, balanceRes, usageDataRes] = await Promise.all([
          fetch('/api/traffic/total'),
          fetch('/api/balance'),
          fetch('/api/traffic/usage-trends'),
        ]);
  
        if (!totalTrafficRes.ok || !balanceRes.ok || !usageDataRes.ok) {
          throw new Error('One or more API calls failed.');
        }
  
        const totalTraffic = await totalTrafficRes.json();
        const balance = await balanceRes.json();
        const usageData = await usageDataRes.json();
  
        // Update state
        setTotalTraffic(totalTraffic.total || 0);
        setRemainingBalance(balance.balance || 0);
        setUsageData(Array.isArray(usageData) ? usageData : []);
        setSubUsers(subUsersList);
      } catch (err) {
        setError('Failed to load dashboard data');
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
  
    fetchDashboardData();
  }, []);


  useEffect(() => {
    if (subUsers.length > 0) {
      setTotalSubUsers(subUsers.length);
    }
  }, [subUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Call the backend API to create the sub-user
      const response = await fetch('/api/sub-users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          label: newUserName, // Use 'label' instead of 'name'
          pool_type: newUserPool, // Use 'pool_type' instead of 'proxyPool'
          threads: 100, // Default threads
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error creating user:', errorData);
        throw new Error('Failed to create new user');
      }
  
      const newUser = await response.json();
  
      // Save the new sub-user to Firestore
      const subUsersCollection = collection(db, "subUsers");
      await addDoc(subUsersCollection, {
        id: newUser.id,
        label: newUser.label,
        login: newUser.login,
        password: newUser.password,
        remainingTraffic: newUser.remainingTraffic || 0,
        balance_format: newUser.balance_format,
        threads: newUser.threads,
        pool_type: newUser.pool_type,
      });
  
      // Update state
      setSubUsers([...subUsers, newUser]);
      setShowNewUserForm(false);
      setNewUserName('');
      setNewUserPool('');
      toast({
        title: 'Success',
        description: `New sub-user created successfully. Login: ${newUser.login}, Password: ${newUser.password}`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Failed to create new sub-user',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/sub-users/${userId}`, {
        method: 'DELETE',
      });
  
      if (!response.ok) {
        throw new Error('Failed to delete user');
      }
  
      // Delete from Firestore
      const userDoc = doc(db, "subUsers", userId);
      await deleteDoc(userDoc);
  
      setSubUsers(subUsers.filter(user => user.id !== userId));
      toast({
        title: "Success",
        description: "Sub-user deleted successfully",
      });
    } catch (err) {
      console.error('Delete user error:', err);
      toast({
        title: "Error",
        description: "Failed to delete sub-user",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  if (error) {
    return <div className="flex items-center justify-center h-screen text-red-500">{error}</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100">
      <div className="container mx-auto p-4">
        <h1 className="text-4xl font-bold mb-6 text-blue-800">Admin Dashboard</h1>

      {/* Overview Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Total Sub-Users</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-800">{totalSubUsers}</div>
          </CardContent>
        </Card>
        <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Total Traffic Consumed</CardTitle>
            <HardDrive className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-800">{totalTraffic} GB</div>
          </CardContent>
        </Card>
        <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-600">Remaining Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-800">${remainingBalance}</div>
          </CardContent>
        </Card>
      </div>

      {/* Traffic Usage Chart */}
      <Card className="mb-6 bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-blue-800">Traffic Usage Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="usage" fill="#4F46E5" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Sub-User Management */}
      <Card className="mb-6 bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-blue-800">Sub-User Management</CardTitle>
          <CardDescription>Manage your sub-users and their proxy settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Button onClick={() => setShowNewUserForm(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" /> Create New Sub-User
            </Button>
          </div>
          {showNewUserForm && (
            <form onSubmit={handleCreateUser} className="mb-4 p-4 border rounded-md bg-blue-50">
              <div className="grid w-full items-center gap-4">
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="Enter user name" />
                </div>
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="pool">Proxy Pool</Label>
                  <Select value={newUserPool} onValueChange={setNewUserPool}>
                    <SelectTrigger id="pool">
                      <SelectValue placeholder="Select proxy pool" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {['residential', 'datacenter', 'mobile'].map((value) => (
                        <SelectItem key={value} value={value}>
                          {value.charAt(0).toUpperCase() + value.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="mt-4">Create User</Button>
            </form>
          )}
          <Table>
            <TableHeader>
              <TableRow className="bg-blue-100">
                <TableHead>Sub-User ID</TableHead>
                <TableHead>Name/Label</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Password</TableHead>
                <TableHead>Remaining Traffic</TableHead>
                <TableHead>Threads</TableHead>
                <TableHead>Proxy Pool</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(Array.isArray(subUsers) ? subUsers : []).map((user) => (
                <TableRow key={user.id} className="hover:bg-blue-50">
                  <TableCell>{user.id}</TableCell>
                  <TableCell>{user.label}</TableCell>
                  <TableCell>{user.login}</TableCell>
                  <TableCell>{user.password}</TableCell>
                  <TableCell>{user.balance_format}</TableCell>
                  <TableCell>{user.threads}</TableCell>
                  <TableCell>{user.pool_type}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">  
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteUser(user.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Proxy Pool Management */}
      <Card className="mb-6 bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-blue-800">Proxy Pool Management</CardTitle>
          <CardDescription>Configure default pool parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="countries">Include Countries</Label>
                <Input id="countries" placeholder="e.g. US, UK, CA" />
              </div>
              <div>
                <Label htmlFor="excludeCountries">Exclude Countries</Label>
                <Input id="excludeCountries" placeholder="e.g. CN, RU" />
              </div>
              <div>
                <Label htmlFor="rotationInterval">Rotation Interval (minutes)</Label>
                <Input id="rotationInterval" type="number" placeholder="e.g. 10" />
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="anonymousFilter" />
                <Label htmlFor="anonymousFilter">Enable Anonymous Filtering</Label>
              </div>
            </div>
            <Button type="submit">Save Configuration</Button>
          </form>
        </CardContent>
      </Card>

      {/* Traffic Management */}
      <Card className="bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-blue-800">Traffic Management</CardTitle>
          <CardDescription>Manage traffic for sub-users</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="subUser">Select Sub-User</Label>
                <Select>
                  <SelectTrigger id="subUser">
                    <SelectValue placeholder="Select sub-user" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {subUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="trafficAmount">Traffic Amount (GB)</Label>
                <Input id="trafficAmount" type="number" placeholder="Enter amount" />
              </div>
            </div>
            <div className="flex space-x-2">
              <Button type="submit">Add Traffic</Button>
              <Button type="button" variant="outline">Remove Traffic</Button>
            </div>
          </form>
          <div className="mt-4">
            <Button variant="outline">View Traffic Usage Logs</Button>
          </div>
        </CardContent>
      </Card>
      </div>
      <Footer />
    </div>
  )
}

