resource "random_pet" "pet" {}

output "pet" {
  value = randxxxxxxom_pet.pet.id
}
