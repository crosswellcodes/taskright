import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MyJobsScreen from '../screens/teamMember/MyJobsScreen';
import JobDetailScreen from '../screens/teamMember/JobDetailScreen';

const Stack = createNativeStackNavigator();

export default function TeamMemberNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MyJobs" component={MyJobsScreen} />
      <Stack.Screen name="JobDetail" component={JobDetailScreen} />
    </Stack.Navigator>
  );
}
