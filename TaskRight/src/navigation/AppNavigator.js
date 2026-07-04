import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';
import PhoneEntryScreen from '../screens/auth/PhoneEntryScreen';
import BusinessNavigator from './BusinessNavigator';
import CustomerNavigator from './CustomerNavigator';
import TeamMemberNavigator from './TeamMemberNavigator';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { token, user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!token ? (
        <Stack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
      ) : user?.type === 'business' ? (
        <Stack.Screen name="BusinessApp" component={BusinessNavigator} />
      ) : user?.type === 'team_member' ? (
        <Stack.Screen name="TeamMemberApp" component={TeamMemberNavigator} />
      ) : (
        <Stack.Screen name="CustomerApp" component={CustomerNavigator} />
      )}
    </Stack.Navigator>
  );
}
