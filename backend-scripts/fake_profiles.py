import json
import random
from faker import Faker

fake = Faker()

# Nationwide US cities for realistic locations (covers all major areas)
US_CITIES = [
    "New York, NY", "Los Angeles, CA", "Chicago, IL", "Houston, TX", "Phoenix, AZ",
    "Philadelphia, PA", "San Antonio, TX", "San Diego, CA", "Dallas, TX", "San Jose, CA",
    "Austin, TX", "Jacksonville, FL", "Fort Worth, TX", "Columbus, OH", "Charlotte, NC",
    "Indianapolis, IN", "Seattle, WA", "Denver, CO", "Washington, DC", "Boston, MA",
    "Tucson, AZ", "Miami, FL", "Las Vegas, NV", "Atlanta, GA", "Orlando, FL",
    "Portland, OR", "Detroit, MI", "Nashville, TN", "Memphis, TN", "Louisville, KY"
]

def generate_fake_profile():
    gender = random.choice(["Male", "Female", "Non-binary"])
    name = fake.name()
    age = random.randint(18, 35)
    location = random.choice(US_CITIES)
    
    bio = fake.paragraph(nb_sentences=3)
    interests = random.sample(["Hiking", "Coffee", "Movies", "Travel", "Gym", "Music", "Food", "Sports", "Books", "Concerts"], 4)
    
    # Use your established graphics / placeholder photos
    photo_url = f"https://picsum.photos/id/{random.randint(100, 300)}/400/400"
    
    profile = {
        "id": str(random.randint(100000, 999999)),
        "name": name,
        "age": age,
        "gender": gender,
        "location": location,
        "bio": bio,
        "interests": interests,
        "photo": photo_url,
        "last_active": "online",
        "fake": True
    }
    return profile

# Generate 500 fake profiles for Walk Up and Talk (US-wide)
profiles = [generate_fake_profile() for _ in range(500)]

with open("fake_profiles.json", "w") as f:
    json.dump(profiles, f, indent=2)

print(f"✅ Generated {len(profiles)} realistic US-wide fake profiles for Walk Up and Talk!")
print("Ready for behavior automation next.")