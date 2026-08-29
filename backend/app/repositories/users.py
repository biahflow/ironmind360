from bson import ObjectId


class UserRepository:
    def __init__(self, database):
        self.collection = database.users

    async def by_email(self, email: str):
        return await self.collection.find_one({"email": email.lower()})

    async def by_id(self, user_id: str):
        if not ObjectId.is_valid(user_id):
            return None
        return await self.collection.find_one({"_id": ObjectId(user_id)})

    async def insert(self, document: dict):
        result = await self.collection.insert_one(document)
        document["_id"] = result.inserted_id
        return document
