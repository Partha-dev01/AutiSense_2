export interface Doctor {
  name: string;
  specialty: "Pediatric Neurologist" | "Child Psychologist" | "Speech Therapist" | "Occupational Therapist";
  location: string;
  city: string;
  phone: string;
  hospital?: string;
  website?: string;
  lat: number;
  lng: number;
}

export const SPECIALTY_COLORS: Record<Doctor["specialty"], string> = {
  "Pediatric Neurologist": "#2980b9",
  "Child Psychologist": "#8e44ad",
  "Speech Therapist": "#27ae60",
  "Occupational Therapist": "#d35400",
};

export const DOCTORS: Doctor[] = [
  // Delhi
  { name: "Dr. Ananya Sharma", specialty: "Pediatric Neurologist", location: "Dwarka Sector 12", city: "Delhi", phone: "+91-11-4567-8901", hospital: "Rainbow Children's Hospital", lat: 28.59, lng: 77.04 },
  { name: "Dr. Vikram Mehta", specialty: "Child Psychologist", location: "Vasant Kunj", city: "Delhi", phone: "+91-11-2634-5520", hospital: "Fortis Mental Health Centre", lat: 28.52, lng: 77.16 },
  { name: "Dr. Priya Nair", specialty: "Speech Therapist", location: "Saket", city: "Delhi", phone: "+91-11-4098-7123", lat: 28.52, lng: 77.22 },

  // Mumbai
  { name: "Dr. Rohan Deshmukh", specialty: "Pediatric Neurologist", location: "Andheri West", city: "Mumbai", phone: "+91-22-6789-4321", hospital: "Kokilaben Dhirubhai Ambani Hospital", lat: 19.14, lng: 72.83 },
  { name: "Dr. Sneha Kulkarni", specialty: "Occupational Therapist", location: "Bandra East", city: "Mumbai", phone: "+91-22-2645-8800", lat: 19.06, lng: 72.85 },
  { name: "Dr. Aditya Joshi", specialty: "Child Psychologist", location: "Dadar", city: "Mumbai", phone: "+91-22-2430-1156", hospital: "Wadia Children's Hospital", lat: 19.02, lng: 72.84 },

  // Bangalore
  { name: "Dr. Kavitha Rao", specialty: "Speech Therapist", location: "Indiranagar", city: "Bangalore", phone: "+91-80-4123-6789", hospital: "Manipal Hospital", lat: 12.98, lng: 77.64 },
  { name: "Dr. Arjun Reddy", specialty: "Pediatric Neurologist", location: "Jayanagar", city: "Bangalore", phone: "+91-80-2654-3300", lat: 12.93, lng: 77.58 },
  { name: "Dr. Meera Iyer", specialty: "Occupational Therapist", location: "Whitefield", city: "Bangalore", phone: "+91-80-4987-2210", hospital: "Cloudnine Hospital", lat: 12.97, lng: 77.75 },

  // Chennai
  { name: "Dr. Lakshmi Venkatesh", specialty: "Child Psychologist", location: "T. Nagar", city: "Chennai", phone: "+91-44-2815-9034", hospital: "Apollo Children's Hospital", lat: 13.04, lng: 80.23 },
  { name: "Dr. Karthik Sundaram", specialty: "Speech Therapist", location: "Adyar", city: "Chennai", phone: "+91-44-2441-6678", lat: 13.00, lng: 80.26 },

  // Kolkata
  { name: "Dr. Debashis Sen", specialty: "Pediatric Neurologist", location: "Salt Lake", city: "Kolkata", phone: "+91-33-4056-7890", hospital: "AMRI Hospital", lat: 22.58, lng: 88.40 },
  { name: "Dr. Rina Chatterjee", specialty: "Occupational Therapist", location: "Park Street", city: "Kolkata", phone: "+91-33-2229-4455", lat: 22.55, lng: 88.35 },

  // Hyderabad
  { name: "Dr. Suresh Patil", specialty: "Child Psychologist", location: "Banjara Hills", city: "Hyderabad", phone: "+91-40-2335-6712", hospital: "Continental Hospitals", lat: 17.41, lng: 78.45 },
  { name: "Dr. Farah Khan", specialty: "Speech Therapist", location: "Jubilee Hills", city: "Hyderabad", phone: "+91-40-2360-9988", lat: 17.43, lng: 78.41 },

  // Pune
  { name: "Dr. Neha Deshpande", specialty: "Occupational Therapist", location: "Kothrud", city: "Pune", phone: "+91-20-2546-3321", hospital: "Sahyadri Hospital", lat: 18.51, lng: 73.81 },
  { name: "Dr. Amol Bhosale", specialty: "Pediatric Neurologist", location: "Koregaon Park", city: "Pune", phone: "+91-20-2613-4456", lat: 18.54, lng: 73.89 },
  { name: "Dr. Tanvi Gokhale", specialty: "Child Psychologist", location: "Aundh", city: "Pune", phone: "+91-20-2588-1190", lat: 18.56, lng: 73.81 },

  // Ahmedabad
  { name: "Dr. Harsh Trivedi", specialty: "Pediatric Neurologist", location: "Navrangpura", city: "Ahmedabad", phone: "+91-79-2656-4430", hospital: "Sterling Hospital", lat: 23.04, lng: 72.56 },
  { name: "Dr. Pooja Shah", specialty: "Speech Therapist", location: "Satellite", city: "Ahmedabad", phone: "+91-79-2692-1107", lat: 23.01, lng: 72.53 },

  // Jaipur
  { name: "Dr. Raghav Mathur", specialty: "Child Psychologist", location: "C-Scheme", city: "Jaipur", phone: "+91-141-2362-778", hospital: "Fortis Escorts Hospital", lat: 26.91, lng: 75.79 },
  { name: "Dr. Sonal Gupta", specialty: "Occupational Therapist", location: "Malviya Nagar", city: "Jaipur", phone: "+91-141-2752-340", lat: 26.86, lng: 75.81 },
];
