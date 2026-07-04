import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import CurrentSelectionScreen from '../screens/customer/CurrentSelectionScreen';
import TaskPickerScreen from '../screens/customer/TaskPickerScreen';
import ConfirmationScreen from '../screens/customer/ConfirmationScreen';
import SuccessScreen from '../screens/customer/SuccessScreen';
import HistoryScreen from '../screens/customer/HistoryScreen';
import FeedbackScreen from '../screens/customer/FeedbackScreen';

const Stack = createNativeStackNavigator();

export default function CustomerNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="CurrentSelection" component={CurrentSelectionScreen} options={{ title: 'My Service' }} />
      <Stack.Screen name="TaskPicker" component={TaskPickerScreen} options={{ title: 'Select Tasks' }} />
      <Stack.Screen name="Confirmation" component={ConfirmationScreen} options={{ title: 'Confirm Selection' }} />
      <Stack.Screen name="Success" component={SuccessScreen} options={{ headerShown: false }} />
      <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'Selection History' }} />
      <Stack.Screen name="Feedback" component={FeedbackScreen} options={{ title: 'Leave Feedback' }} />
    </Stack.Navigator>
  );
}
