import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { AppThemeProvider } from "./src/context/ThemeContext";
import { useAppTheme } from "./src/hooks/useAppTheme";
import { CyclesStackParamList, GoalsStackParamList, MoreStackParamList, PillarsStackParamList, TasksStackParamList } from "./src/navigation/types";
import CycleDetailScreen from "./src/screens/cycles/CycleDetailScreen";
import CycleFormScreen from "./src/screens/cycles/CycleFormScreen";
import CyclesListScreen from "./src/screens/cycles/CyclesListScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import GoalDetailScreen from "./src/screens/goals/GoalDetailScreen";
import GoalFormScreen from "./src/screens/goals/GoalFormScreen";
import GoalsListScreen from "./src/screens/goals/GoalsListScreen";
import LoginScreen from "./src/screens/LoginScreen";
import LogScreen from "./src/screens/LogScreen";
import MoreScreen from "./src/screens/MoreScreen";
import PillarDetailScreen from "./src/screens/pillars/PillarDetailScreen";
import PillarFormScreen from "./src/screens/pillars/PillarFormScreen";
import PillarsListScreen from "./src/screens/pillars/PillarsListScreen";
import TaskFormScreen from "./src/screens/TaskFormScreen";
import TasksScreen from "./src/screens/TasksScreen";

const Tab = createBottomTabNavigator();
const GoalsStack = createNativeStackNavigator<GoalsStackParamList>();
const CyclesStack = createNativeStackNavigator<CyclesStackParamList>();
const PillarsStack = createNativeStackNavigator<PillarsStackParamList>();
const TasksStack = createNativeStackNavigator<TasksStackParamList>();
const MoreStack = createNativeStackNavigator<MoreStackParamList & { GoalsStack: undefined; CyclesStack: undefined; PillarsStack: undefined }>();

const TAB_ICONS: Record<string, string> = {
  Tasks: "📋",
  Log: "📝",
  More: "•••",
};

function GoalsStackNavigator() {
  return (
    <GoalsStack.Navigator screenOptions={{ headerShown: true }}>
      <GoalsStack.Screen name="GoalsList" component={GoalsListScreen} options={{ headerShown: false }} />
      <GoalsStack.Screen name="GoalDetail" component={GoalDetailScreen} options={{ title: "Goal" }} />
      <GoalsStack.Screen name="GoalForm" component={GoalFormScreen} options={{ title: "" }} />
    </GoalsStack.Navigator>
  );
}

function CyclesStackNavigator() {
  return (
    <CyclesStack.Navigator screenOptions={{ headerShown: true }}>
      <CyclesStack.Screen name="CyclesList" component={CyclesListScreen} options={{ headerShown: false }} />
      <CyclesStack.Screen name="CycleDetail" component={CycleDetailScreen} options={{ title: "Cycle" }} />
      <CyclesStack.Screen name="CycleForm" component={CycleFormScreen} options={{ title: "" }} />
    </CyclesStack.Navigator>
  );
}

function PillarsStackNavigator() {
  return (
    <PillarsStack.Navigator screenOptions={{ headerShown: true }}>
      <PillarsStack.Screen name="PillarsList" component={PillarsListScreen} options={{ headerShown: false }} />
      <PillarsStack.Screen name="PillarDetail" component={PillarDetailScreen} options={{ title: "Pillar" }} />
      <PillarsStack.Screen name="PillarForm" component={PillarFormScreen} options={{ title: "" }} />
    </PillarsStack.Navigator>
  );
}

function TasksStackNavigator() {
  return (
    <TasksStack.Navigator screenOptions={{ headerShown: false }}>
      <TasksStack.Screen name="TasksList" component={TasksScreen} />
      <TasksStack.Screen name="TaskForm" component={TaskFormScreen} options={{ headerShown: true, title: "" }} />
    </TasksStack.Navigator>
  );
}

function MoreStackNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: true }}>
      <MoreStack.Screen name="MoreMenu" component={MoreScreen} options={{ headerShown: false }} />
      <MoreStack.Screen name="GoalsStack" component={GoalsStackNavigator} options={{ headerShown: false, title: "Goals" }} />
      <MoreStack.Screen name="CyclesStack" component={CyclesStackNavigator} options={{ headerShown: false, title: "Cycles" }} />
      <MoreStack.Screen name="PillarsStack" component={PillarsStackNavigator} options={{ headerShown: false, title: "Pillars" }} />
      <MoreStack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: true, title: "Dashboard" }} />
    </MoreStack.Navigator>
  );
}

function AppTabs() {
  const theme = useAppTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.subtext,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border },
        tabBarIcon: () => <TabIcon label={TAB_ICONS[route.name]} />,
      })}
    >
      <Tab.Screen name="Tasks" component={TasksStackNavigator} />
      <Tab.Screen name="Log" component={LogScreen} />
      <Tab.Screen name="More" component={MoreStackNavigator} />
    </Tab.Navigator>
  );
}

function TabIcon({ label }: { label: string }) {
  return <Text style={{ fontSize: 20 }}>{label}</Text>;
}

function Root() {
  const { isLoading, isSignedIn } = useAuth();
  const theme = useAppTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return isSignedIn ? <AppTabs /> : <LoginScreen />;
}

function AppRoot() {
  const theme = useAppTheme();

  return (
    <NavigationContainer theme={theme.dark ? DarkTheme : DefaultTheme}>
      <Root />
      <StatusBar style={theme.dark ? "light" : "dark"} />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <AuthProvider>
            <AppRoot />
          </AuthProvider>
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
