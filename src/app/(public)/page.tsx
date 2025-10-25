'use client';

import Link from 'next/link';
import { authPaths } from '@/lib/paths';
import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

function AnimatedSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={fadeInUp}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <motion.h1 
              className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 mb-6"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              Find Your Perfect
              <span className="block bg-gradient-to-r from-[#FF6B4A] via-[#FF8C5A] to-[#FFB84D] bg-clip-text text-transparent">
                Sports Coach
              </span>
            </motion.h1>
            <motion.p 
              className="text-xl sm:text-2xl text-gray-600 mb-10 leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            >
              Connect with verified coaches for personalized training in basketball, soccer, tennis, and more.
            </motion.p>
            <motion.div 
              className="flex flex-col sm:flex-row gap-4 justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
            >
              <Link
                href={authPaths.signUp()}
                className="px-8 py-4 bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] text-white text-lg font-semibold rounded-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
              >
                I'm an Athlete
              </Link>
              <Link
                href={authPaths.signUp()}
                className="px-8 py-4 bg-white text-gray-900 text-lg font-semibold rounded-lg border-2 border-gray-200 hover:border-[#FF6B4A] hover:shadow-lg transition-all duration-200"
              >
                I'm a Coach
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-white">
        <AnimatedSection>
          <motion.div 
            className="max-w-7xl mx-auto"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <motion.div className="text-center" variants={fadeInUp}>
                <div className="text-5xl font-bold bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] bg-clip-text text-transparent mb-2">
                  1000+
                </div>
                <div className="text-gray-600 text-lg">Verified Coaches</div>
              </motion.div>
              <motion.div className="text-center" variants={fadeInUp}>
                <div className="text-5xl font-bold bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] bg-clip-text text-transparent mb-2">
                  15+
                </div>
                <div className="text-gray-600 text-lg">Sports Available</div>
              </motion.div>
              <motion.div className="text-center" variants={fadeInUp}>
                <div className="text-5xl font-bold bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] bg-clip-text text-transparent mb-2">
                  50K+
                </div>
                <div className="text-gray-600 text-lg">Sessions Booked</div>
              </motion.div>
            </div>
          </motion.div>
        </AnimatedSection>
      </section>

      {/* How It Works */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              How Hubletics Works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Getting started is simple. Find, book, and train with top coaches in your area.
            </p>
          </AnimatedSection>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-12"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {/* Step 1 */}
            <motion.div className="relative" variants={fadeInUp}>
              <div className="flex flex-col items-center text-center">
                <motion.div 
                  className="w-16 h-16 bg-gradient-to-br from-[#FF6B4A] to-[#FF8C5A] rounded-2xl flex items-center justify-center mb-6 shadow-lg"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </motion.div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                  Search & Discover
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Browse verified coaches by sport, location, availability, and expertise level. Read reviews and compare rates.
                </p>
              </div>
            </motion.div>

            {/* Step 2 */}
            <motion.div className="relative" variants={fadeInUp}>
              <div className="flex flex-col items-center text-center">
                <motion.div 
                  className="w-16 h-16 bg-gradient-to-br from-[#FF6B4A] to-[#FF8C5A] rounded-2xl flex items-center justify-center mb-6 shadow-lg"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </motion.div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                  Book Sessions
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Message coaches directly, view their real-time availability, and book training sessions that fit your schedule.
                </p>
              </div>
            </motion.div>

            {/* Step 3 */}
            <motion.div className="relative" variants={fadeInUp}>
              <div className="flex flex-col items-center text-center">
                <motion.div 
                  className="w-16 h-16 bg-gradient-to-br from-[#FF6B4A] to-[#FF8C5A] rounded-2xl flex items-center justify-center mb-6 shadow-lg"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </motion.div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                  Train & Improve
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Attend your personalized training sessions and track your progress. Leave reviews to help others find great coaches.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features for Athletes */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <AnimatedSection>
              <div className="inline-block px-4 py-2 bg-[#FF6B4A]/10 rounded-full text-[#FF6B4A] font-semibold text-sm mb-6">
                FOR ATHLETES
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
                Take Your Game to the Next Level
              </h2>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Whether you're a beginner or looking to refine advanced skills, find coaches who understand your goals and can help you achieve them.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-[#FF6B4A]/10 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#FF6B4A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Personalized Training Plans</h3>
                    <p className="text-gray-600">Coaches create custom programs tailored to your skill level and goals.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-[#FF6B4A]/10 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#FF6B4A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Flexible Scheduling</h3>
                    <p className="text-gray-600">Book sessions that work with your schedule, from early mornings to evenings.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-[#FF6B4A]/10 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#FF6B4A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Secure Payments</h3>
                    <p className="text-gray-600">Pay safely through our platform with automatic booking confirmations.</p>
                  </div>
                </div>
              </div>
            </AnimatedSection>

            <AnimatedSection className="relative">
              <motion.div 
                className="aspect-square bg-gradient-to-br from-[#FF6B4A]/20 to-[#FFB84D]/20 rounded-3xl"
                whileHover={{ scale: 1.02, rotate: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
              />
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Features for Coaches */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <AnimatedSection className="relative order-2 lg:order-1">
              <motion.div 
                className="aspect-square bg-gradient-to-br from-[#FF8C5A]/20 to-[#FF6B4A]/20 rounded-3xl"
                whileHover={{ scale: 1.02, rotate: -1 }}
                transition={{ type: "spring", stiffness: 200 }}
              />
            </AnimatedSection>

            <AnimatedSection className="order-1 lg:order-2">
              <div className="inline-block px-4 py-2 bg-[#FF6B4A]/10 rounded-full text-[#FF6B4A] font-semibold text-sm mb-6">
                FOR COACHES
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
                Grow Your Coaching Business
              </h2>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Reach motivated athletes, manage your schedule effortlessly, and focus on what you do best—coaching.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-[#FF6B4A]/10 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#FF6B4A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Verified Profile & Credentials</h3>
                    <p className="text-gray-600">Build trust with verified certifications and background checks.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-[#FF6B4A]/10 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#FF6B4A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Automated Scheduling & Payments</h3>
                    <p className="text-gray-600">Let athletes book directly and get paid automatically after each session.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-[#FF6B4A]/10 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#FF6B4A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Expand Your Reach</h3>
                    <p className="text-gray-600">Connect with athletes beyond your immediate network and grow your client base.</p>
                  </div>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Sports Covered */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              Sports We Cover
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Find expert coaching across a wide range of sports and activities.
            </p>
          </AnimatedSection>

          <motion.div 
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              'Basketball',
              'Soccer',
              'Tennis',
              'Swimming',
              'Baseball',
              'Volleyball',
              'Track & Field',
              'Golf',
              'Wrestling',
              'Gymnastics'
            ].map((sport) => (
              <motion.div
                key={sport}
                variants={fadeInUp}
                whileHover={{ scale: 1.05, borderColor: '#FF6B4A' }}
                className="bg-white border border-gray-200 rounded-xl p-6 text-center transition-all duration-200 cursor-pointer"
              >
                <div className="text-lg font-semibold text-gray-900">{sport}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-gray-600 mb-10 leading-relaxed">
            Join thousands of athletes and coaches using Hubletics to achieve their goals.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={authPaths.signUp()}
              className="px-8 py-4 bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] text-white text-lg font-semibold rounded-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
            >
              Sign Up Now
            </Link>
            <Link
              href="#"
              className="px-8 py-4 bg-white text-gray-900 text-lg font-semibold rounded-lg border-2 border-gray-200 hover:border-[#FF6B4A] hover:shadow-lg transition-all duration-200"
            >
              Learn More
            </Link>
          </div>
        </AnimatedSection>
      </section>
    </div>
  );
}
