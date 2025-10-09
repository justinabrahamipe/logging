"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FaWallet, FaClock, FaCheckCircle, FaProjectDiagram, FaDumbbell, FaArrowRight, FaBullseye, FaClipboardList, FaTasks } from "react-icons/fa";

export default function Home() {
  const features = [
    { title: "Finance", icon: FaWallet },
    { title: "Time", icon: FaClock },
    { title: "Tasks", icon: FaCheckCircle },
    { title: "Projects", icon: FaProjectDiagram },
    { title: "Exercise", icon: FaDumbbell },
  ];

  const quickAccess = [
    {
      title: "Activities",
      description: "Manage your logging categories",
      icon: FaBullseye,
      href: "/activities",
      color: "from-blue-500 to-cyan-500"
    },
    {
      title: "Logs",
      description: "View and analyze your entries",
      icon: FaClipboardList,
      href: "/log",
      color: "from-purple-500 to-pink-500"
    },
    {
      title: "Todo",
      description: "Track your tasks and goals",
      icon: FaTasks,
      href: "/todo",
      color: "from-orange-500 to-red-500"
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring" as const,
        stiffness: 100,
      },
    },
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <motion.img
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.5 }}
            src="https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?q=80&w=2072&auto=format&fit=crop"
            alt="Minimalist workspace"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60 dark:from-black/70 dark:via-black/60 dark:to-black/80"></div>
        </div>

        {/* Content */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="relative z-10 text-center px-4 max-w-5xl mx-auto"
        >
          <motion.h1
            variants={itemVariants}
            className="text-6xl md:text-8xl font-bold text-white mb-6 tracking-tight"
          >
            Log Everything
          </motion.h1>
          <motion.p
            variants={itemVariants}
            className="text-xl md:text-3xl text-white/90 mb-12 font-light max-w-3xl mx-auto"
          >
            Track your life with purpose. Finance, time, tasks, projects, and exercise—all in one place.
          </motion.p>

          {/* Feature Pills */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap justify-center gap-4 mb-16"
          >
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                whileHover={{ scale: 1.05, y: -2 }}
                className="bg-white/15 backdrop-blur-md text-white px-6 py-3 rounded-full border border-white/30 flex items-center gap-2 shadow-lg"
              >
                <feature.icon className="text-lg" />
                <span className="font-medium">{feature.title}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-5 justify-center items-center"
          >
            <Link href="/activities">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-white text-gray-900 px-8 py-4 rounded-lg font-semibold text-lg min-w-[200px] shadow-xl hover:shadow-2xl transition-shadow flex items-center justify-center gap-2 group"
              >
                Get Started
                <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </Link>
            <Link href="/log">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg min-w-[200px] backdrop-blur-sm hover:bg-white/10 transition-colors"
              >
                View Logs
              </motion.button>
            </Link>
          </motion.div>
        </motion.div>
      </div>

      {/* Quick Access Section */}
      <div className="py-24 px-4 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-900 dark:text-white"
          >
            Quick Access
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-8">
            {quickAccess.map((item, index) => (
              <Link key={item.title} href={item.href}>
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className="relative p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all overflow-hidden group"
                >
                  {/* Gradient overlay on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-10 transition-opacity`}></div>

                  <div className="relative z-10">
                    <div className={`inline-flex p-4 rounded-xl bg-gradient-to-br ${item.color} text-white mb-6 shadow-lg`}>
                      <item.icon className="text-3xl" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {item.description}
                    </p>
                    <div className="flex items-center text-gray-500 dark:text-gray-500 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      <span className="text-sm font-medium">Explore</span>
                      <FaArrowRight className="ml-2 group-hover:translate-x-2 transition-transform" />
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
