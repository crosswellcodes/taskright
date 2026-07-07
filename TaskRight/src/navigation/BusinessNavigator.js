import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import DashboardScreen from '../screens/business/DashboardScreen';
import ForecastDayScreen from '../screens/business/ForecastDayScreen';
import CustomerListScreen from '../screens/business/CustomerListScreen';
import CustomerDetailScreen from '../screens/business/CustomerDetailScreen';
import AddCustomerScreen from '../screens/business/AddCustomerScreen';
import AssignCycleScreen from '../screens/business/AssignCycleScreen';
import ServiceDaySnapshotScreen from '../screens/business/ServiceDaySnapshotScreen';
import CustomerPreferencesScreen from '../screens/business/CustomerPreferencesScreen';
import CustomerFeedbackDetailScreen from '../screens/business/CustomerFeedbackDetailScreen';
import ServiceCallDetailScreen from '../screens/business/ServiceCallDetailScreen';
import MessageThreadScreen from '../screens/business/MessageThreadScreen';
import TasksScreen from '../screens/business/TasksScreen';
import ServiceCyclesScreen from '../screens/business/ServiceCyclesScreen';
import TeamScreen from '../screens/business/TeamScreen';
import AddTeamMemberScreen from '../screens/business/AddTeamMemberScreen';
import EditTeamMemberScreen from '../screens/business/EditTeamMemberScreen';
import TeamGroupFormScreen from '../screens/business/TeamGroupFormScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function DashboardStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="DashboardMain" component={DashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ForecastDay" component={ForecastDayScreen} options={{ title: 'Service Day' }} />
    </Stack.Navigator>
  );
}

function CustomersStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="CustomerList" component={CustomerListScreen} options={{ title: 'Customers' }} />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ title: 'Customer' }} />
      <Stack.Screen name="AddCustomer" component={AddCustomerScreen} options={{ title: 'Add Customer' }} />
      <Stack.Screen name="AssignCycle" component={AssignCycleScreen} options={{ title: 'Service' }} />
      <Stack.Screen name="ServiceDaySnapshot" component={ServiceDaySnapshotScreen} options={{ title: 'Day Overview' }} />
      <Stack.Screen name="CustomerPreferences" component={CustomerPreferencesScreen} options={{ title: 'Customer Details' }} />
      <Stack.Screen name="CustomerFeedbackDetail" component={CustomerFeedbackDetailScreen} options={{ title: 'Customer Feedback' }} />
      <Stack.Screen name="ServiceCallDetail" component={ServiceCallDetailScreen} options={{ title: 'Service Call' }} />
      <Stack.Screen name="MessageThread" component={MessageThreadScreen} options={{ title: 'Messages' }} />
    </Stack.Navigator>
  );
}

function TeamStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="TeamList" component={TeamScreen} options={{ title: 'Team' }} />
      <Stack.Screen name="AddTeamMember" component={AddTeamMemberScreen} options={{ title: 'Add Team Member' }} />
      <Stack.Screen name="EditTeamMember" component={EditTeamMemberScreen} options={{ title: 'Edit Team Member' }} />
      <Stack.Screen
        name="TeamGroupForm"
        component={TeamGroupFormScreen}
        options={({ route }) => ({ title: route.params?.group ? 'Edit Group' : 'New Group' })}
      />
    </Stack.Navigator>
  );
}

export default function BusinessNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Dashboard" component={DashboardStack} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="Customers" component={CustomersStack} options={{ title: 'Customers' }} />
      <Tab.Screen name="Tasks" component={TasksScreen} options={{ title: 'Tasks' }} />
      <Tab.Screen name="Cycles" component={ServiceCyclesScreen} options={{ title: 'Service Cycles' }} />
      <Tab.Screen name="Team" component={TeamStack} options={{ title: 'Team' }} />
    </Tab.Navigator>
  );
}
